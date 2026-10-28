import type { StoredDocument } from "../../doc/stored-document";
import type { FolderTrashResult, TrashDeleteResult, TrashListResult, TrashTarget } from "../trash";
import type { ReferenceKind, ReferenceOccurrence } from "../types";
import type { EntryMetadata, MediaAssetRecord } from "./types";

/** The types of the trash port (`TrashStore` in `ports.ts`). What the HTTP layer sends is in `core/trash.ts`; these are what the store and the services exchange. */

/** What discarding a folder did, with the entries it discarded (their events are delivered after the commit). */
export interface FolderTrashOutcome extends FolderTrashResult {
	readonly entryIds: readonly string[];
}

/** What restoring a folder did. */
export interface FolderRestoreOutcome {
	/** The live folder that now holds what came back: the folder itself, or the folder it was merged into. */
	readonly folderId: string;
	/** A folder on the way had to be made again. */
	readonly recreated: boolean;
	/** The entries that came back. */
	readonly entryIds: readonly string[];
}

/** A unit at the top of the trash, as emptying and the purge read it. */
export interface TrashUnit extends TrashTarget {
	readonly title: string | null;
	/** The day it was discarded; what the 30 days count from. */
	readonly deletedAt: Date;
}

/** A trash list as the store reads it: media files carry their storage key, so the service can make their address. */
export interface TrashListRead extends TrashListResult {
	readonly mediaKeys: Readonly<Record<string, string>>;
}

/** What deleting units for good did in the database. The stored files of the media files are the service's to delete. */
export interface DeleteTrashedOutcome {
	/** One per target, in the order of the request. */
	readonly results: readonly TrashDeleteResult[];
	/** The media files whose rows stay until their stored files are deleted, with the index of the target they belong to. */
	readonly files: readonly { readonly index: number; readonly media: MediaAssetRecord }[];
	/** The entries that were deleted (their events are delivered after the commit). */
	readonly entryIds: readonly string[];
}

/** A stored body as the unlink reads it. */
export interface UnlinkBody {
	readonly entryId: string;
	readonly collection: string;
	readonly state: "working" | "published";
	readonly metadata: EntryMetadata;
	readonly doc: StoredDocument;
}

/** A body after the targets were taken out of its relation fields, as the write rules prepared it. */
export interface UnlinkedBody {
	readonly metadata: EntryMetadata;
	readonly doc: StoredDocument;
	readonly contentHash: string;
	/** The references of the body's metadata fields. The references of the text are kept as they are. */
	readonly references: readonly {
		readonly kind: ReferenceKind;
		readonly targetId: string;
		readonly occurrences: readonly ReferenceOccurrence[];
	}[];
}

export interface UnlinkParams {
	/** Entries to take out of the relation fields of the others. */
	readonly targetIds?: readonly string[];
	/** Every entry of this collection is a target. */
	readonly collection?: string;
	/**
	 * Called for each stored body that points at a target from a relation field, inside the transaction, with the ids to take out. Returns the body to store,
	 * or `null` to leave it as it is. It must not touch the database. If it throws, nothing is changed.
	 */
	readonly rewrite: (body: UnlinkBody, targetIds: ReadonlySet<string>) => Promise<UnlinkedBody | null>;
}

export interface UnlinkOutcome {
	/** Entries that were changed. */
	readonly entries: number;
	readonly entryIds: readonly string[];
}
