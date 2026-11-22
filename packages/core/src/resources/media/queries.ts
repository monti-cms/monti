import type { Selectable } from "kysely";
import type { MediaTable } from "../../db/types";
import { MontiError } from "../../engine/errors";
import type { ReadContext, StorageAdapter, WriteContext } from "../../engine/types";
import { isActiveFolder } from "../folders/folders";

/** What the media actions return of a media item: its row without `trashed_at`, and where its file is read from. */
export interface MediaItem {
	id: string;
	folder_id: string | null;
	key: string;
	filename: string;
	mime_type: string;
	size: number;
	width: number | null;
	height: number | null;
	url: string;
}

export const SHOWN = ["id", "folder_id", "key", "filename", "mime_type", "size", "width", "height"] as const;

/** How long a file nothing uses waits in `loose_files` before it is removed. */
const LOOSE_FOR_MS = 24 * 60 * 60 * 1000;

/** The engine's storage; the media resource is refused without one. */
export function storageOf(ctx: ReadContext): StorageAdapter {
	if (ctx.storage === undefined) throw new MontiError("BAD_REQUEST", "No storage is set up for the media");
	return ctx.storage;
}

export function itemOf(row: Omit<Selectable<MediaTable>, "trashed_at">, storage: StorageAdapter): MediaItem {
	return { ...row, url: storage.url(row.key) };
}

/** The uploaded file at `key`; rejects a key with no file. */
export async function statOf(storage: StorageAdapter, key: string): Promise<{ mime: string; size: number }> {
	const stat = await storage.stat(key);
	if (stat === null) throw new MontiError("BAD_REQUEST", "No uploaded file has this key");
	return stat;
}

/** Rejects a key some media row already has, a trashed one included. */
export async function rejectTakenKey(ctx: WriteContext, key: string): Promise<void> {
	const taken = await ctx.db.selectFrom("media").select("id").where("key", "=", key).executeTakeFirst();
	if (taken !== undefined) throw new MontiError("CONFLICT", "A media item already has this key");
}

/** `"media"` 범위의 활성 폴더가 아니면 거절한다. */
export async function rejectFolder(ctx: WriteContext, folderId: string): Promise<void> {
	if (!(await isActiveFolder(ctx, folderId, "media"))) {
		throw new MontiError("BAD_REQUEST", "The folder is not an active media folder");
	}
}

/** Puts `key` in `loose_files`, to be removed in 24 hours. */
export async function addLooseFile(ctx: WriteContext, key: string): Promise<void> {
	const remove_after = new Date(Date.now() + LOOSE_FOR_MS);
	await ctx.db
		.insertInto("loose_files")
		.values({ key, remove_after })
		.onConflict((conflict) => conflict.column("key").doUpdateSet({ remove_after }))
		.execute();
}

/** Takes `key` out of `loose_files`: something uses its file now. */
export async function removeLooseFile(ctx: WriteContext, key: string): Promise<void> {
	await ctx.db.deleteFrom("loose_files").where("key", "=", key).execute();
}
