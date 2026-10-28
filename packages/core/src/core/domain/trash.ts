import type { EntryStatus } from "../store/types";
import { type TrashUsage, trashExpiresAt } from "../trash";

/**
 * Trash rules for folders, entries and media files. One action stamps everything it discards with the same time (the stamp), so what came to the trash
 * together can go back together, and what was discarded earlier stays where it is. A folder is live when it has no stamp; a live folder has only live
 * ancestors. The store reads the rows and runs these rules in a transaction.
 *
 * Two rules live in the SQL of the trash list (`trash-list.ts`) because they decide which rows a page holds: a unit is at the top of the trash when its folder is
 * live or absent (inside a trashed folder it goes with the folder, and counts its days from the top trashed folder), and a translation discarded together with its
 * source (the same stamp) is a language of the source's row, not a row of its own.
 */

/** A folder as the trash rules see it. */
export interface FolderStamp {
	readonly id: string;
	readonly deletedAt: Date | null;
}

/** The folders a trash of a folder takes: those of its subtree (itself included) that are not in the trash yet. The ones trashed earlier keep their own stamp. */
export const foldersToTrash = (subtree: readonly FolderStamp[]): string[] =>
	subtree.filter((folder) => folder.deletedAt === null).map((folder) => folder.id);

/** The entries a trash of a folder takes: every one not in the trash yet, translations included (a draft, a published, an archived entry alike). */
export const entriesToTrash = (entries: readonly { readonly id: string; readonly status: EntryStatus }[]): string[] =>
	entries.filter((entry) => entry.status !== "trashed").map((entry) => entry.id);

/** The media files a trash of a folder takes: the ready ones. A file still uploading or failed is the upload cleanup's, not the trash's. */
export const mediaToTrash = (files: readonly { readonly id: string; readonly status: string }[]): string[] =>
	files.filter((file) => file.status === "ready").map((file) => file.id);

/**
 * A stamp for a new trash action: the database time cut to the millisecond (the precision a JavaScript date keeps, so a stamp read back equals the stamp
 * written), moved past every stamp already in the subtree so nothing trashed earlier can share it.
 */
export function nextTrashStamp(now: Date, existing: readonly (Date | null)[]): Date {
	let stamp = Math.floor(now.getTime());
	for (const time of existing) if (time && time.getTime() >= stamp) stamp = time.getTime() + 1;
	return new Date(stamp);
}

/** Whether something discarded at `deletedAt` came to the trash with the action that stamped `stamp`. */
export const cameWith = (deletedAt: Date | null | undefined, stamp: Date): boolean =>
	deletedAt != null && deletedAt.getTime() === stamp.getTime();

/** What a restore of a folder stamped `stamp` brings back from `items`: those discarded by the same action. */
export const restoredWith = <T extends { readonly deletedAt: Date | null }>(items: readonly T[], stamp: Date): T[] =>
	items.filter((item) => cameWith(item.deletedAt, stamp));

/** Whether the purge deletes a unit discarded (effectively) at `deletedAt`: it was kept for the whole time. */
export const isTrashExpired = (deletedAt: Date, now: Date): boolean =>
	now.getTime() >= trashExpiresAt(deletedAt).getTime();

/** How discarding a media folder splits its files: all go with the folder, or (when some are in use) only the unused ones, each on its own. */
export interface MediaFolderPlan {
	/** The folder goes to the trash with everything in it. */
	readonly whole: boolean;
	/** The files that go to the trash. */
	readonly trash: string[];
	/** The files in use, which stay. */
	readonly kept: string[];
}

export function planMediaFolderTrash(files: readonly string[], inUse: ReadonlySet<string>): MediaFolderPlan {
	const kept = files.filter((id) => inUse.has(id));
	return { whole: kept.length === 0, trash: files.filter((id) => !inUse.has(id)), kept };
}

/** One entry that refers to what is being deleted, with how it refers. */
export interface ReferrerRow {
	readonly entryId: string;
	readonly collection: string;
	readonly title: string | null;
	readonly trashed: boolean;
	/** The occurrences of every reference row the entry has to the targets. */
	readonly occurrences: readonly { readonly type: string }[];
}

/**
 * The entries that stop a permanent delete: those outside what is deleted whose relation field points at it (an occurrence of type `metadata`). A link in
 * a body never does: the delete removes that reference and the link stays in the text as a broken link.
 */
export function blockingUsages(rows: readonly ReferrerRow[], deleting: ReadonlySet<string>): TrashUsage[] {
	const byEntry = new Map<string, TrashUsage>();
	for (const row of rows) {
		if (deleting.has(row.entryId) || byEntry.has(row.entryId)) continue;
		if (!row.occurrences.some((occurrence) => occurrence.type === "metadata")) continue;
		byEntry.set(row.entryId, {
			entryId: row.entryId,
			title: row.title,
			collection: row.collection,
			trashed: row.trashed,
		});
	}
	return [...byEntry.values()].sort((a, b) => (a.entryId < b.entryId ? -1 : a.entryId > b.entryId ? 1 : 0));
}

/** Every entry that refers to media being deleted blocks it, whatever the way (a media field or a body image). */
export function blockingMediaUsages(rows: readonly ReferrerRow[], deleting: ReadonlySet<string>): TrashUsage[] {
	return blockingUsages(
		rows.map((row) => ({ ...row, occurrences: [{ type: "metadata" }] })),
		deleting,
	);
}
