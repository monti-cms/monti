import { isItemCollection } from "../collections";
import { CmsError } from "../store/errors";
import type { EntryStatus } from "../store/types";

/**
 * Lifecycle rules: which status each transition starts from, what a source's transition does to its translations, and
 * when a trashed entry may be deleted for good. A disallowed source status is rejected with `invalid_status` (409), for example so that
 * pressing `보관 해제` or `복원` on a published entry cannot silently take it offline.
 */

export type LifecycleAction = "archive" | "unarchive" | "trash" | "restore";

const ALLOWED_FROM: Record<LifecycleAction, readonly EntryStatus[]> = {
	archive: ["draft", "published"],
	unarchive: ["archived"],
	trash: ["draft", "published", "archived"],
	restore: ["trashed"],
};

/** Status after the transition. A restored publish-collection entry returns to draft. */
export const STATUS_AFTER: Record<LifecycleAction, EntryStatus> = {
	archive: "archived",
	unarchive: "draft",
	trash: "trashed",
	restore: "draft",
};

export function assertTransitionAllowed(action: LifecycleAction, status: EntryStatus, version: number): void {
	if (!ALLOWED_FROM[action].includes(status)) {
		throw new CmsError(`Cannot change status from ${status}`, "invalid_status", version);
	}
}

/** Record collections (tags, categories, ...) have no archive. */
export function assertArchivable(collection: string, version: number): void {
	if (isItemCollection(collection)) {
		throw new CmsError("Record collections cannot be archived", "invalid_status", version);
	}
}

/** A record in use must have its references released before it goes to the trash. */
export const trashRequiresNoReferences = (collection: string): boolean => isItemCollection(collection);

/** A record collection is published again on restore (with its prepared draft); a content collection returns to draft. */
export const restorePublishesAgain = (collection: string): boolean => isItemCollection(collection);

/** Restoring a translation while its source is in the trash would leave it out of the list (one row per source) without shared values. */
export function assertSourceNotTrashed(sourceStatus: EntryStatus | undefined, version: number): void {
	if (sourceStatus === "trashed") throw new CmsError("Restore the source first", "source_trashed", version);
}

/** A record's prepared draft is required to publish it again on restore. */
export function assertRestoreSnapshot(snapshot: unknown): void {
	if (!snapshot) throw new CmsError("Restoring a record needs its prepared draft", "invalid_input");
}

/** Only a trashed entry can be deleted for good. */
export function assertDeletable(status: EntryStatus, version: number): void {
	if (status !== "trashed") {
		throw new CmsError("Only trashed entries can be permanently deleted", "invalid_status", version);
	}
}

/** A translation of the group, as the store reads it (locked) when a source changes status. */
export interface GroupMember {
	readonly id: string;
	readonly status: EntryStatus;
	readonly trashedAt: Date | null;
}

const idsOf = (members: readonly GroupMember[]): string[] => members.map((member) => member.id);

/** The translations a source's transition applies to. A transition applies to the whole group. */
export function membersToArchive(members: readonly GroupMember[]): string[] {
	return idsOf(members.filter((member) => member.status === "draft" || member.status === "published"));
}

export function membersToUnarchive(members: readonly GroupMember[]): string[] {
	return idsOf(members.filter((member) => member.status === "archived"));
}

export function membersToTrash(members: readonly GroupMember[]): string[] {
	return idsOf(members.filter((member) => member.status !== "trashed"));
}

/** Only translations trashed together with the source (the same trash time) come back. Translations trashed separately stay in the trash. */
export function membersToRestore(members: readonly GroupMember[], sourceTrashedAt: Date | null): string[] {
	if (!sourceTrashedAt) return [];
	return idsOf(
		members.filter(
			(member) => member.status === "trashed" && member.trashedAt?.getTime() === sourceTrashedAt.getTime(),
		),
	);
}

/**
 * Deleting a source deletes its translations too, so a translation outside the trash blocks it (it would lose its shared values).
 * Returns the blocking translations' IDs, empty when the delete may go on.
 */
export function blockingTranslations(members: readonly GroupMember[]): string[] {
	return idsOf(members.filter((member) => member.status !== "trashed"));
}
