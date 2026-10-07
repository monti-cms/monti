import { createHash, timingSafeEqual } from "node:crypto";
import {
	type AfterCommit,
	CmsError,
	type ContentEvent,
	type EventDelivery,
	type EventDeliveryCounts,
	type EventDeliveryState,
	type EventStore,
} from "../core/store";
import type { Entry } from "../core/store/types";

/**
 * Delivery of the committed changes (the outbox, `core/store/events.ts`) to the subscribers: `hooks.afterCommit` of the server config and of the plugins.
 *
 * - The store wrote the events in the transaction of the change. After the commit the dispatcher makes one delivery per subscriber and tries it right away,
 *   in the same process, so latency is what it was before the outbox.
 * - A delivery that fails is tried again later with a growing delay, and is dead-lettered (`dead`) after `maxAttempts` tries. Nothing runs in the background:
 *   retries happen on the next write of the same process (a few at a time, at most once per `SWEEP_EVERY_MS`), on `cms.events.retry()`, from `monti events:retry`
 *   and from the `POST /v1/events/retry` route a cron can call. That is what serverless hosting allows.
 * - Delivery is at least once and in the commit order per entry: an event is not delivered to a subscriber while an earlier event of the same entry is
 *   still waiting for it (pending, in flight, or failed and not yet dead). Subscribers must be idempotent; `event.eventId` identifies an event.
 */

/** One subscriber. The name is stable: it keys the delivery state, so renaming a subscriber starts it afresh. */
export interface EventSubscriber {
	/** `server` for the server config, `plugin:<name>` for a plugin. */
	readonly name: string;
	readonly handler: AfterCommit;
}

/** Server config `events`: how failed deliveries are retried and kept. */
export interface EventDeliveryOptions {
	/** Tries a delivery gets, the first one included, before it is dead-lettered. Default 8. */
	readonly maxAttempts?: number;
	/** Milliseconds to wait after the given failed try (1 for the first). Default: 15 seconds, doubling, at most an hour. */
	readonly backoffMs?: (attempt: number) => number;
	/** How long finished events are kept, in days. Default 30. */
	readonly retentionDays?: number;
	/**
	 * A secret for `POST /api/cms/v1/events/retry` (`Authorization: Bearer <secret>`), so a cron job can start the retries without an admin login.
	 * Without it the route needs an admin session. Keep it in an environment variable.
	 */
	readonly retrySecret?: string;
}

export interface EventRetryOptions {
	/** Also try the failed deliveries that are not due yet (their backoff is skipped). Dead ones are never retried this way. */
	readonly all?: boolean;
	/** Most deliveries to try in this call. Default 100. */
	readonly limit?: number;
}

/** What a retry did. */
export interface EventRetryResult {
	/** Deliveries that succeeded. */
	readonly delivered: number;
	/** Deliveries that failed and will be tried again. */
	readonly failed: number;
	/** Deliveries that failed on their last allowed try and were dead-lettered. */
	readonly dead: number;
}

export interface EventListOptions {
	/** Default `failed` and `dead`. */
	readonly states?: readonly EventDeliveryState[];
	readonly limit?: number;
	readonly offset?: number;
}

/** `cms.events`: the delivery side of the outbox. */
export interface CmsEvents {
	/** Delivers what is due (and, with `all`, what is failed): the call for a cron job, a command or a button. Never throws for a failing subscriber. */
	retry(options?: EventRetryOptions): Promise<EventRetryResult>;
	/** Deliveries, newest event first. */
	list(options?: EventListOptions): Promise<{ items: EventDelivery[]; total: number }>;
	/** How many deliveries are in each state. */
	counts(): Promise<EventDeliveryCounts>;
	/** Puts a failed or dead delivery back to `pending` and tries it now. Returns `false` when there is no such failed or dead delivery. */
	retryDelivery(params: { eventId: string; subscriber: string }): Promise<boolean>;
	/** Whether `token` is the server config's `events.retrySecret` (the bearer token of the retry route). `false` when no secret is configured. */
	acceptsRetryToken(token: string | null | undefined): boolean;
	/** Gives up on a failed or dead delivery: it is no longer retried or listed, and no longer holds the order of its entry. Returns `false` when there is none. */
	dismiss(params: { eventId: string; subscriber: string }): Promise<boolean>;
}

export interface EventDispatcherOptions extends EventDeliveryOptions {
	/** The store with the outbox. Read on each call, so it may be created lazily. */
	readonly store: () => EventStore & { getEntry(id: string): Promise<Entry> };
	readonly subscribers: () => Promise<readonly EventSubscriber[]>;
	readonly now?: () => Date;
}

export interface EventDispatcher {
	readonly events: CmsEvents;
	/** Delivers the events of an entry that were just committed, then, now and then, the retries that are due. Never throws. */
	dispatchEntry(entryId: string): Promise<void>;
}

export const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_RETRY_LIMIT = 100;
/** Leave a claimed delivery to its caller for this long before it can be claimed again (a crash or a timeout in the middle of a try). */
const LEASE_MS = 2 * 60 * 1000;
/** The retries a write starts are limited to this many, and at most once per this interval per process. */
const SWEEP_LIMIT = 5;
const SWEEP_EVERY_MS = 10 * 1000;
/** Events with no delivery rows (the process stopped between the commit and the dispatch) are picked up for this long. */
const ORPHAN_WINDOW_MS = 24 * 60 * 60 * 1000;
const PRUNE_EVERY_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const defaultBackoffMs = (attempt: number): number => Math.min(15_000 * 2 ** (attempt - 1), 60 * 60 * 1000);

const errorText = (error: unknown): string => (error instanceof Error ? error.message || error.name : String(error));

export function createEventDispatcher(options: EventDispatcherOptions): EventDispatcher {
	const now = options.now ?? (() => new Date());
	const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
	const backoffMs = options.backoffMs ?? defaultBackoffMs;
	const retentionMs = (options.retentionDays ?? DEFAULT_RETENTION_DAYS) * DAY_MS;
	const store = options.store;

	const deliver = async (
		claim: { change: ContentEvent; subscriber: string; attempts: number },
		handler: AfterCommit,
		result: { delivered: number; failed: number; dead: number },
	) => {
		const { change, subscriber, attempts } = claim;
		try {
			await handler(change);
			await store().completeDelivery({ eventId: change.eventId, subscriber, now: now() });
			result.delivered += 1;
		} catch (error) {
			const at = now();
			const state = await store()
				.failDelivery({
					eventId: change.eventId,
					subscriber,
					error: errorText(error),
					now: at,
					retryAt: new Date(at.getTime() + backoffMs(attempts)),
					maxAttempts,
				})
				.catch((failure) => {
					// The failure could not be recorded: the claim runs out and the delivery is tried again.
					console.error("[cms] could not record a failed event delivery", change.eventId, failure);
					return "failed" as const;
				});
			result[state] += 1;
			console.error(
				`[cms] afterCommit of ${subscriber} failed (${change.kind} ${change.entryId}, event ${change.eventId}, try ${attempts}${state === "dead" ? ", dead-lettered" : ""})`,
				error,
			);
		}
	};

	/** Claims and delivers what is due until nothing is left or `limit` deliveries were tried. */
	const drain = async (params: { entryIds?: readonly string[]; limit: number; ignoreBackoff?: boolean }) => {
		const result = { delivered: 0, failed: 0, dead: 0 };
		const subscribers = await options.subscribers();
		if (subscribers.length === 0) return result;
		const byName = new Map(subscribers.map((subscriber) => [subscriber.name, subscriber.handler]));
		let remaining = params.limit;
		let ignoreBackoff = params.ignoreBackoff;
		while (remaining > 0) {
			const claims = await store().claimDeliveries({
				subscribers: [...byName.keys()],
				now: now(),
				leaseMs: LEASE_MS,
				limit: remaining,
				entryIds: params.entryIds,
				ignoreBackoff,
			});
			// Only the first round skips the backoff: a delivery that fails again must not be tried again at once.
			ignoreBackoff = false;
			if (claims.length === 0) break;
			for (const claim of claims) {
				const handler = byName.get(claim.subscriber);
				if (!handler) continue;
				const change: ContentEvent = {
					...claim.change,
					attempt: claim.attempts,
					read: () => readEntry(claim.change.entryId),
				};
				await deliver({ change, subscriber: claim.subscriber, attempts: claim.attempts }, handler, result);
			}
			remaining -= claims.length;
		}
		return result;
	};

	const readEntry = async (entryId: string): Promise<Entry | null> => {
		try {
			return await store().getEntry(entryId);
		} catch (error) {
			if (error instanceof CmsError && error.code === "not_found") return null;
			throw error;
		}
	};

	/** Makes the delivery rows of events that have none (the process stopped between the commit and the dispatch), then delivers what is due. */
	const retry = async (retryOptions: EventRetryOptions = {}): Promise<EventRetryResult> => {
		const subscribers = await options.subscribers();
		if (subscribers.length > 0) {
			await store().enqueueEvents({
				subscribers: subscribers.map((subscriber) => subscriber.name),
				since: new Date(now().getTime() - ORPHAN_WINDOW_MS),
				now: now(),
			});
		}
		return drain({ limit: retryOptions.limit ?? DEFAULT_RETRY_LIMIT, ignoreBackoff: retryOptions.all });
	};

	let lastSweep = 0;
	let lastPrune = 0;
	/** The retries a write carries along. Throttled, small, and silent about failures: the write already succeeded. */
	const sweep = async () => {
		const at = now().getTime();
		if (at - lastSweep < SWEEP_EVERY_MS) return;
		lastSweep = at;
		await retry({ limit: SWEEP_LIMIT });
		if (at - lastPrune >= PRUNE_EVERY_MS) {
			lastPrune = at;
			await store().pruneEvents({ before: new Date(at - retentionMs) });
		}
	};

	const events: CmsEvents = {
		retry,
		list: (listOptions) => store().listEventDeliveries(listOptions),
		counts: () => store().countEventDeliveries(),
		retryDelivery: async ({ eventId, subscriber }) => {
			const reset = await store().retryDelivery({ eventId, subscriber, now: now() });
			if (!reset) return false;
			await drain({ limit: DEFAULT_RETRY_LIMIT });
			return true;
		},
		dismiss: ({ eventId, subscriber }) => store().dismissDelivery({ eventId, subscriber }),
		acceptsRetryToken: (token) => {
			if (!options.retrySecret || !token) return false;
			const digest = (value: string) => createHash("sha256").update(value).digest();
			return timingSafeEqual(digest(token), digest(options.retrySecret));
		},
	};

	return {
		events,
		dispatchEntry: async (entryId) => {
			const subscribers = await options.subscribers();
			if (subscribers.length > 0) {
				await store().enqueueEvents({
					subscribers: subscribers.map((subscriber) => subscriber.name),
					entryId,
					now: now(),
				});
				await drain({ entryIds: [entryId], limit: DEFAULT_RETRY_LIMIT });
			}
			await sweep().catch((error) => console.error("[cms] event retry failed", error));
		},
	};
}
