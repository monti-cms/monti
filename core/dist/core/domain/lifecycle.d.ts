import type { Site } from "../../site/index.js";
import type { EntryStatus } from "../store/types.js";
/**
 * Lifecycle rules: which status each transition starts from, what a source's transition does to its translations, and
 * when a trashed entry may be deleted for good. A disallowed source status is rejected with `invalid_status` (409), for example so that
 * pressing `보관 해제` or `복원` on a published entry cannot silently take it offline.
 */
export type LifecycleAction = "archive" | "unarchive" | "trash" | "restore";
/** Status after the transition. A restored publish-collection entry returns to draft. */
export declare const STATUS_AFTER: Record<LifecycleAction, EntryStatus>;
export declare function assertTransitionAllowed(action: LifecycleAction, status: EntryStatus, version: number): void;
/** Record collections (tags, categories, ...) have no archive. */
export declare function assertArchivable(site: Site, collection: string, version: number): void;
/** A record in use must have its references released before it goes to the trash. */
export declare const trashRequiresNoReferences: (site: Site, collection: string) => boolean;
/** A record collection is published again on restore (with its prepared draft); a content collection returns to draft. */
export declare const restorePublishesAgain: (site: Site, collection: string) => boolean;
/** Restoring a translation while its source is in the trash would leave it out of the list (one row per source) without shared values. */
export declare function assertSourceNotTrashed(sourceStatus: EntryStatus | undefined, version: number): void;
/** A record's prepared draft is required to publish it again on restore. */
export declare function assertRestoreSnapshot(snapshot: unknown): void;
/** Only a trashed entry can be deleted for good. */
export declare function assertDeletable(status: EntryStatus, version: number): void;
/** A translation of the group, as the store reads it (locked) when a source changes status. */
export interface GroupMember {
    readonly id: string;
    readonly status: EntryStatus;
    readonly trashedAt: Date | null;
}
/** The translations a source's transition applies to. A transition applies to the whole group. */
export declare function membersToArchive(members: readonly GroupMember[]): string[];
export declare function membersToUnarchive(members: readonly GroupMember[]): string[];
export declare function membersToTrash(members: readonly GroupMember[]): string[];
/** Only translations trashed together with the source (the same trash time) come back. Translations trashed separately stay in the trash. */
export declare function membersToRestore(members: readonly GroupMember[], sourceTrashedAt: Date | null): string[];
/**
 * Deleting a source deletes its translations too, so a translation outside the trash blocks it (it would lose its shared values).
 * Returns the blocking translations' IDs, empty when the delete may go on.
 */
export declare function blockingTranslations(members: readonly GroupMember[]): string[];
