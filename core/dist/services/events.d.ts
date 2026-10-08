import { type AfterCommit, type EventDelivery, type EventDeliveryCounts, type EventDeliveryState, type EventStore } from "../core/store/index.js";
import type { Entry } from "../core/store/types.js";
import type { PluginCollection } from "../plugin/storage.js";
/**
 * Delivery of the committed changes (the outbox, `core/store/events.ts`) to the subscribers: `hooks.afterCommit` of the server config and of the plugins.
 *
 * - The store wrote the events in the transaction of the change. After the commit the dispatcher makes one delivery per subscriber and tries it right away,
 *   in the same process, so latency is what it was before the outbox.
 * - A delivery that fails is tried again later with a growing delay, and is dead-lettered (`dead`) after `maxAttempts` tries. Nothing runs in the background:
 *   retries happen on the next write of the same process (a few at a time, at most once per `SWEEP_EVERY_MS`), on `cms.events.retry()`, from `monti events:retry`
 *   and from the `POST /v1/events/retry` route a cron can call. That is what serverless hosting allows.
 * - Delivery is at least once and in the commit order per entry: an event is not delivered to a subscriber while an earlier event of the same entry is
 *   still waiting for it (pending, in flight, or failed and not yet dead). Subscribers must be idempotent: `event.once(run)` runs work once per event and
 *   subscriber, however many times the delivery is tried (it keeps a mark per event in `marks`, and prunes the marks with the events).
 */
/** Where `event.once` keeps its marks: a collection of the instance's plugin storage. */
export type EventMarks = Pick<PluginCollection<{
    at: string;
}>, "get" | "set" | "list" | "delete">;
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
    /** Deliveries a subscriber deferred (asked to be called again later): rescheduled, not failures. */
    readonly deferred: number;
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
    list(options?: EventListOptions): Promise<{
        items: EventDelivery[];
        total: number;
    }>;
    /** How many deliveries are in each state. */
    counts(): Promise<EventDeliveryCounts>;
    /** Puts a failed or dead delivery back to `pending` and tries it now. Returns `false` when there is no such failed or dead delivery. */
    retryDelivery(params: {
        eventId: string;
        subscriber: string;
    }): Promise<boolean>;
    /** Whether `token` is the server config's `events.retrySecret` (the bearer token of the retry route). `false` when no secret is configured. */
    acceptsRetryToken(token: string | null | undefined): boolean;
    /** Gives up on a failed or dead delivery: it is no longer retried or listed, and no longer holds the order of its entry. Returns `false` when there is none. */
    dismiss(params: {
        eventId: string;
        subscriber: string;
    }): Promise<boolean>;
}
export interface EventDispatcherOptions extends EventDeliveryOptions {
    /** The store with the outbox. Read on each call, so it may be created lazily. */
    readonly store: () => EventStore & {
        getEntry(id: string): Promise<Entry>;
    };
    readonly subscribers: () => Promise<readonly EventSubscriber[]>;
    /** Where `event.once` keeps its marks. Without it the marks live in the memory of the process, which only a test wants. */
    readonly marks?: () => EventMarks;
    readonly now?: () => Date;
}
export interface EventDispatcher {
    readonly events: CmsEvents;
    /** Delivers the events of an entry that were just committed, then, now and then, the retries that are due. Never throws. */
    dispatchEntry(entryId: string): Promise<void>;
}
export declare const DEFAULT_MAX_ATTEMPTS = 8;
export declare const defaultBackoffMs: (attempt: number) => number;
export declare function createEventDispatcher(options: EventDispatcherOptions): EventDispatcher;
