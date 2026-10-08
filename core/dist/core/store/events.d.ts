import type { Entry, EntryStatus } from "./types.js";
/**
 * The event outbox. Every committed change of an entry leaves an event row in the same transaction as the write, so an event exists exactly when its
 * change does. Delivering the event to the subscribers (the server config's and the plugins' `hooks.afterCommit`) happens after the commit and is retried;
 * the delivery state of each subscriber is kept per event.
 */
/** Kind of change the store made. */
export type ContentChangeKind = "created" | "saved" | "published" | "archived" | "unarchived" | "trashed" | "restored" | "deleted";
/** The kinds, for the stores and for tests. */
export declare const CONTENT_CHANGE_KINDS: readonly ContentChangeKind[];
/**
 * One committed change, as the outbox stored it. Archiving, trashing, or restoring a source also changes its translations, so `translationGroupId` covers the
 * whole group (the change is reported once, for the entry it was made on).
 */
export interface ContentChange {
    /** Identifies the event. The same event can be delivered more than once (delivery is at least once), so a subscriber that must not act twice remembers it. */
    readonly eventId: string;
    readonly kind: ContentChangeKind;
    readonly entryId: string;
    readonly collection: string;
    readonly locale: string;
    readonly translationGroupId: string;
    /** State after the change. For a deletion, the last state. */
    readonly status: EntryStatus;
    /** Public URL (if a published version existed). */
    readonly publishedSlug: string | null;
    /** Draft URL. */
    readonly workingSlug: string | null;
    /** Entry version after the change (a create or save that also published has the final version on both of its events). */
    readonly version: number;
    /** Content hash of the body the change leaves: the published body for `published`, the draft for every other kind. */
    readonly contentHash: string | null;
    /** When the change was committed. */
    readonly occurredAt: Date;
}
/** What a subscriber's `afterCommit` receives: the change, how many times this delivery was tried, and a way to read the committed entry. */
export interface ContentEvent extends ContentChange {
    /** 1 for the first try, 2 for the first retry, and so on. */
    readonly attempt: number;
    /**
     * The entry as it is now, or `null` when it was deleted. Compare `version` of the result with `event.version`: when it is higher the entry changed again and
     * a later event is (or was) delivered for it, so a subscriber that exports the entry can skip the stale one. The delivery order per entry is the commit order.
     */
    read(): Promise<Entry | null>;
    /**
     * Runs `run` once for this event and this subscriber, however many times the delivery is tried. Delivery is at least once, so a subscriber whose work
     * must not be repeated (a message, a charge, an export) wraps it in `once`: when an earlier try already finished `run`, it is skipped and this returns
     * `false`; otherwise `run` runs, the event is marked done once it returned, and this returns `true`. A `run` that throws is not marked, so the retry
     * runs it again. The mark is kept as long as the event is (`events.retentionDays`). Only a crash between the end of `run` and the mark can repeat it.
     */
    once(run: () => void | Promise<void>): Promise<boolean>;
}
/**
 * Called after the change is committed (create, save, publish, archive, trash, restore, delete): cache refresh, webhooks, search indexing, a git commit.
 * The change stands even if it fails, and the failure is retried. Delivery is at least once, so it must be idempotent: wrap work that
 * must not be repeated in `event.once(...)`.
 */
export type AfterCommit = (event: ContentEvent) => void | DeferredDelivery | Promise<void | DeferredDelivery>;
/**
 * What a subscriber returns (or, as {@link DeferDelivery}, throws) to say "not yet, call me again at `retryAt`", for example while it batches events. The delivery
 * is rescheduled: it is not a failure, so it is not listed as failed, does not count in the failed badge, does not use up an attempt and never dead-letters.
 * It still holds the order of the entry's later events.
 */
export interface DeferredDelivery {
    readonly retryAt: Date;
}
/** Throw it from a subscriber to defer the delivery (see {@link DeferredDelivery}). */
export declare class DeferDelivery extends Error implements DeferredDelivery {
    readonly retryAt: Date;
    constructor(retryAt: Date, message?: string);
}
export declare const isDeferred: (value: unknown) => value is DeferredDelivery;
/**
 * Delivery state of one event for one subscriber.
 * `pending`: not tried yet. `delivering`: claimed by a dispatcher (a claim that is not finished in time can be claimed again). `delivered`: done.
 * `failed`: tried and failed, tried again when `nextAttemptAt` is reached. `dead`: failed on every try it was allowed (dead-lettered); only a manual retry
 * delivers it. `dismissed`: a failed or dead delivery someone gave up on.
 */
export type EventDeliveryState = "pending" | "delivering" | "delivered" | "failed" | "dead" | "dismissed";
/** An event and one subscriber's delivery state. */
export interface EventDelivery {
    readonly change: ContentChange;
    readonly subscriber: string;
    readonly state: EventDeliveryState;
    readonly attempts: number;
    readonly lastError: string | null;
    readonly lastAttemptAt: Date | null;
    /** When a `pending` or `failed` delivery is next due. */
    readonly nextAttemptAt: Date | null;
    readonly deliveredAt: Date | null;
}
/** A delivery the dispatcher claimed. `attempts` counts this try. */
export interface ClaimedDelivery {
    readonly change: ContentChange;
    readonly subscriber: string;
    readonly attempts: number;
}
/** Number of deliveries per state. */
export type EventDeliveryCounts = Readonly<Record<EventDeliveryState, number>>;
/** The event of a change on an entry, built from the entry as the change leaves it. Stores use it to write the row. */
export declare function eventRowOf(kind: ContentChangeKind, entry: Entry): {
    kind: ContentChangeKind;
    entryId: string;
    collection: string;
    locale: string;
    version: number;
    contentHash: string;
    payload: {
        translationGroupId: string;
        status: EntryStatus;
        publishedSlug: string | null;
        workingSlug: string | null;
    };
};
