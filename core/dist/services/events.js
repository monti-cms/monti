import { createHash, timingSafeEqual } from "node:crypto";
import { CmsError, DeferDelivery, isDeferred, } from "../core/store/index.js";
import { createMemoryPluginStorage } from "../plugin/memory-storage.js";
const memoryMarks = () => createMemoryPluginStorage().storage("core-events").collection("once");
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
export const defaultBackoffMs = (attempt) => Math.min(15_000 * 2 ** (attempt - 1), 60 * 60 * 1000);
const errorText = (error) => (error instanceof Error ? error.message || error.name : String(error));
export function createEventDispatcher(options) {
    const now = options.now ?? (() => new Date());
    const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    const backoffMs = options.backoffMs ?? defaultBackoffMs;
    const retentionMs = (options.retentionDays ?? DEFAULT_RETENTION_DAYS) * DAY_MS;
    const store = options.store;
    const fallbackMarks = memoryMarks();
    const marksOf = () => options.marks?.() ?? fallbackMarks;
    /** `event.once` of one delivery: skips `run` when an earlier try of this event for this subscriber finished it, and marks it done after `run` returns. */
    const onceOf = (subscriber, eventId) => async (run) => {
        const marks = marksOf();
        const key = `${subscriber}/${eventId}`;
        if (await marks.get(key))
            return false;
        await run();
        try {
            await marks.set(key, { at: now().toISOString() }, { expectedVersion: 0 });
        }
        catch (error) {
            // Another try marked it first: the work is done either way.
            if (!(error instanceof CmsError && error.code === "conflict"))
                throw error;
        }
        return true;
    };
    const deliver = async (claim, handler, result) => {
        const { change, subscriber, attempts } = claim;
        try {
            const outcome = await handler(change);
            if (isDeferred(outcome))
                throw new DeferDelivery(outcome.retryAt);
            await store().completeDelivery({ eventId: change.eventId, subscriber, now: now() });
            result.delivered += 1;
        }
        catch (error) {
            if (isDeferred(error)) {
                // "Not yet": rescheduled, not a failure (nothing is logged, no attempt is used, it is not listed as failed).
                const rescheduled = await store()
                    .deferDelivery({ eventId: change.eventId, subscriber, retryAt: error.retryAt })
                    .catch((failure) => {
                    console.error("[cms] could not defer an event delivery", change.eventId, failure);
                    return false;
                });
                if (rescheduled)
                    result.deferred += 1;
                return;
            }
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
                return "failed";
            });
            result[state] += 1;
            console.error(`[cms] afterCommit of ${subscriber} failed (${change.kind} ${change.entryId}, event ${change.eventId}, try ${attempts}${state === "dead" ? ", dead-lettered" : ""})`, error);
        }
    };
    /** Claims and delivers what is due until nothing is left or `limit` deliveries were tried. */
    const drain = async (params) => {
        const result = { delivered: 0, failed: 0, dead: 0, deferred: 0 };
        const subscribers = await options.subscribers();
        if (subscribers.length === 0)
            return result;
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
            if (claims.length === 0)
                break;
            for (const claim of claims) {
                const handler = byName.get(claim.subscriber);
                if (!handler)
                    continue;
                const change = {
                    ...claim.change,
                    attempt: claim.attempts,
                    read: () => readEntry(claim.change.entryId),
                    once: onceOf(claim.subscriber, claim.change.eventId),
                };
                await deliver({ change, subscriber: claim.subscriber, attempts: claim.attempts }, handler, result);
            }
            remaining -= claims.length;
        }
        return result;
    };
    const readEntry = async (entryId) => {
        try {
            return await store().getEntry(entryId);
        }
        catch (error) {
            if (error instanceof CmsError && error.code === "not_found")
                return null;
            throw error;
        }
    };
    /** Makes the delivery rows of events that have none (the process stopped between the commit and the dispatch), then delivers what is due. */
    const retry = async (retryOptions = {}) => {
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
    /** Drops the marks of events old enough to be pruned. A failure leaves them for the next time. */
    const pruneMarks = async (before) => {
        const marks = marksOf();
        try {
            for (const item of await marks.list()) {
                if (item.updatedAt < before)
                    await marks.delete(item.key, { expectedVersion: item.version });
            }
        }
        catch (error) {
            console.error("[cms] could not prune the marks of event.once", error);
        }
    };
    let lastSweep = 0;
    let lastPrune = 0;
    /** The retries a write carries along. Throttled, small, and silent about failures: the write already succeeded. */
    const sweep = async () => {
        const at = now().getTime();
        if (at - lastSweep < SWEEP_EVERY_MS)
            return;
        lastSweep = at;
        await retry({ limit: SWEEP_LIMIT });
        if (at - lastPrune >= PRUNE_EVERY_MS) {
            lastPrune = at;
            const before = new Date(at - retentionMs);
            await store().pruneEvents({ before });
            await pruneMarks(before);
        }
    };
    const events = {
        retry,
        list: (listOptions) => store().listEventDeliveries(listOptions),
        counts: () => store().countEventDeliveries(),
        retryDelivery: async ({ eventId, subscriber }) => {
            const reset = await store().retryDelivery({ eventId, subscriber, now: now() });
            if (!reset)
                return false;
            await drain({ limit: DEFAULT_RETRY_LIMIT });
            return true;
        },
        dismiss: ({ eventId, subscriber }) => store().dismissDelivery({ eventId, subscriber }),
        acceptsRetryToken: (token) => {
            if (!options.retrySecret || !token)
                return false;
            const digest = (value) => createHash("sha256").update(value).digest();
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
