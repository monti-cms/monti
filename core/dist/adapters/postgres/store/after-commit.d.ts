import type { Entry, EntryStatus } from "./types.js";
/** Kind of change the store made. */
export type ContentChangeKind = "created" | "saved" | "published" | "archived" | "unarchived" | "trashed" | "restored" | "deleted";
/**
 * Post-save notification. Delivered only after the transaction commits (changes rolled back by failure or conflict are not reported).
 * Used by cache refresh, webhooks, and search indexing. Archiving, trashing, or restoring a source also changes its translations, so `translationGroupId` covers the whole group.
 */
export interface ContentChange {
    readonly kind: ContentChangeKind;
    readonly entryId: string;
    readonly collection: string;
    readonly locale: string;
    readonly translationGroupId: string;
    /** State after the change. For a deletion, the last state. */
    readonly status: EntryStatus;
    /** Public URL (if a published version exists). */
    readonly publishedSlug: string | null;
    /** Draft URL. */
    readonly workingSlug: string | null;
}
export type AfterCommit = (change: ContentChange) => void | Promise<void>;
interface ChangingStore {
    getEntry(id: string): Promise<Entry>;
    permanentDeleteEntry(params: {
        id: string;
        expectedVersion: number;
    }): Promise<void>;
}
/**
 * Wraps the store's mutation functions so `afterCommit` is called after the commit. If the notification fails, the committed change stays
 * and the request does not fail (the error is only logged).
 */
export declare function withAfterCommit<S extends ChangingStore>(store: S, afterCommit: AfterCommit): S;
export {};
