/**
 * The trash as the admin and the API see it: one list of units (an entry with the translations trashed with it, a folder with everything trashed with it, a
 * media file), each kept for {@link TRASH_DAYS} days from the day it was discarded and then purged. A thing inside a trashed folder counts its days from the
 * folder's date.
 */

/** Days a unit stays in the trash before the purge deletes it. */
export const TRASH_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** When a unit discarded at `deletedAt` is purged. */
export const trashExpiresAt = (deletedAt: Date): Date => new Date(deletedAt.getTime() + TRASH_DAYS * DAY_MS);

/** Whole days left before the purge, never below 0. A unit discarded today has {@link TRASH_DAYS} left. */
export const trashDaysLeft = (deletedAt: Date, now: Date): number =>
	Math.max(0, TRASH_DAYS - Math.floor((now.getTime() - deletedAt.getTime()) / DAY_MS));

/** What a trash tab holds: a collection's name, or `media` for files and media folders. */
export type TrashKind = string;

/** The media library's kind in the trash. */
export const MEDIA_TRASH_KIND = "media";

/** An entry in the trash. A source row carries the translations trashed with it in `locales`; a translation trashed alone is its own row. */
export interface TrashEntryItem {
	readonly type: "entry";
	readonly id: string;
	readonly collection: string;
	readonly locale: string;
	readonly translationGroupId: string;
	readonly isSource: boolean;
	readonly title: string | null;
	readonly slug: string | null;
	readonly version: number;
	readonly deletedAt: Date;
	/** When the purge deletes it; `null` inside a trashed folder, which goes with the folder. */
	readonly expiresAt: Date | null;
	/** The languages that came to the trash in this row, the row's own first. */
	readonly locales: readonly string[];
	/** It was published at some point, so its address is kept after a permanent delete. */
	readonly everPublished: boolean;
	/** A translation whose source is in the trash: it cannot be restored before the source. */
	readonly sourceTrashed: boolean;
	/** The source's title, for a translation. */
	readonly sourceTitle: string | null;
	/** Folder names from the collection's top to the folder the entry was in. */
	readonly path: readonly string[];
	/** Entries whose relation fields point at it (in the trash or not). Body links are not counted: they never block a delete. */
	readonly usages: number;
}

/** A folder in the trash, holding what was trashed with it. */
export interface TrashFolderItem {
	readonly type: "folder";
	readonly id: string;
	/** The collection of an entry folder, or `media`. */
	readonly collection: string;
	readonly name: string;
	readonly version: number;
	readonly deletedAt: Date;
	readonly expiresAt: Date | null;
	readonly path: readonly string[];
	/** What is in it, its subfolders included. Entries are counted once per translation group. */
	readonly entries: number;
	readonly folders: number;
	readonly files: number;
}

/** A media file in the trash. */
export interface TrashMediaItem {
	readonly type: "media";
	readonly id: string;
	readonly filename: string;
	readonly mimeType: string | null;
	readonly byteSize: number | null;
	readonly width: number | null;
	readonly height: number | null;
	/** The library's alt text, empty when it has none. */
	readonly alt: string;
	readonly folderId: string | null;
	readonly deletedAt: Date;
	readonly expiresAt: Date | null;
	readonly path: readonly string[];
	/** The file's address for a preview, or `null`. */
	readonly url: string | null;
}

export type TrashItem = TrashEntryItem | TrashFolderItem | TrashMediaItem;

/** Which unit a request names. Entries and folders take the version the screen saw. */
export interface TrashTarget {
	readonly type: TrashItem["type"];
	readonly id: string;
	readonly expectedVersion?: number;
}

/** An entry whose relation field points at something being deleted. */
export interface TrashUsage {
	readonly entryId: string;
	readonly title: string | null;
	readonly collection: string;
	/** The pointing entry is in the trash itself: it can be deleted together. */
	readonly trashed: boolean;
}

export interface TrashListParams {
	/** Only these kinds (a collection or `media`), any of them. All kinds when unset or empty. */
	readonly kinds?: readonly TrashKind[];
	/** Look inside this trashed folder: its direct children. */
	readonly folderId?: string;
	/** Text to find in titles, slugs, folder names and file names, inside trashed folders too. */
	readonly search?: string;
	/** By the day each unit was discarded. Newest first by default. */
	readonly direction?: "asc" | "desc";
	readonly page?: number;
	readonly pageSize?: 25 | 50 | 100;
}

export interface TrashListResult {
	readonly items: readonly TrashItem[];
	readonly total: number;
	/** Units at the top of the trash per kind, only the kinds that hold some, for the kind filter's counts. Not narrowed by `kinds`. */
	readonly kinds: Readonly<Record<TrashKind, number>>;
	/** The folder looked inside (`folderId`), with its own date and path. */
	readonly folder?: TrashFolderItem;
}

export type TrashRestoreResult =
	| {
			readonly type: TrashItem["type"];
			readonly id: string;
			readonly ok: true;
			/** The live folder it went back to (`null`: the top). */
			readonly folderId?: string | null;
			/** A folder on its way back had to be made again. */
			readonly recreated?: boolean;
	  }
	| {
			readonly type: TrashItem["type"];
			readonly id: string;
			readonly ok: false;
			readonly error: string;
			/** `source_trashed`: the source to restore first. */
			readonly sourceId?: string;
	  };

export type TrashDeleteResult =
	| { readonly type: TrashItem["type"]; readonly id: string; readonly ok: true }
	| {
			readonly type: TrashItem["type"];
			readonly id: string;
			readonly ok: false;
			readonly error: string;
			readonly usages?: readonly TrashUsage[];
	  };

/** What emptying (or the purge) did: how many units went, and the ones that stayed because something points at them. */
export interface TrashEmptyResult {
	readonly deleted: number;
	readonly kept: readonly {
		readonly type: TrashItem["type"];
		readonly id: string;
		readonly title: string | null;
		readonly usages: readonly TrashUsage[];
	}[];
}

/** What a folder holds before it is discarded, its subfolders included; only things outside the trash. */
export interface FolderContents {
	/** Entries, once per translation group. */
	readonly entries: number;
	/** Of those, the published ones (a confirmation is asked only for these). */
	readonly published: number;
	readonly folders: number;
	readonly files: number;
	/** Files something points at: they stay when a media folder is discarded. */
	readonly filesInUse: number;
}

/** What discarding a folder did. `folder` is `null` when the folder stayed (a media folder with files in use) and only the unused files went. */
export interface FolderTrashResult {
	readonly folder: TrashFolderItem | null;
	readonly entries: number;
	readonly folders: number;
	readonly files: number;
	/** Files that stayed because something points at them. */
	readonly kept: number;
}

/** What discarding media files did: in-use files stay. */
export interface MediaTrashResult {
	readonly trashed: readonly string[];
	readonly kept: readonly string[];
}
