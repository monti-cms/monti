import { type Selectable, sql, type Transaction } from "kysely";
import type { Database, MediaTable } from "../../db/types";
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

/** 미디어 파일 크기의 상한: `media.size` 열인 PostgreSQL `integer`의 최대값. */
export const MAX_MEDIA_SIZE = 2_147_483_647;

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

/** 올라간 `key`의 파일. 파일이 없거나 크기가 `0` 이상 `MAX_MEDIA_SIZE` 이하의 정수가 아니면 거절한다. */
export async function statOf(storage: StorageAdapter, key: string): Promise<{ mime: string; size: number }> {
	const stat = await storage.stat(key);
	if (stat === null) throw new MontiError("BAD_REQUEST", "No uploaded file has this key");
	if (!Number.isInteger(stat.size) || stat.size < 0 || stat.size > MAX_MEDIA_SIZE) {
		throw new MontiError("BAD_REQUEST", "파일 크기가 허용 범위를 벗어났다");
	}
	return stat;
}

/** 이 트랜잭션이 끝날 때까지 저장소 키 `key`를 잠근다. 다른 트랜잭션이 잠갔으면 풀릴 때까지 기다린다. */
export async function lockStorageKey(db: Transaction<Database>, key: string): Promise<void> {
	await sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`.execute(db);
}

/** 저장소 키 `key`를 기다리지 않고 잠근다. 다른 트랜잭션이 이미 잠갔으면 `false`다. */
export async function tryLockStorageKey(db: Transaction<Database>, key: string): Promise<boolean> {
	const { rows } = await sql<{ locked: boolean }>`
		select pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) as locked
	`.execute(db);
	return rows[0]?.locked === true;
}

/** 휴지통에 없는 미디어 행을 이 트랜잭션이 끝날 때까지 잠가 돌려준다. 없으면 `NOT_FOUND`다. */
export async function lockActiveMedia(
	ctx: WriteContext,
	id: string,
): Promise<Omit<Selectable<MediaTable>, "trashed_at">> {
	const row = await ctx.db
		.selectFrom("media")
		.select(SHOWN)
		.where("id", "=", id)
		.where("trashed_at", "is", null)
		.forNoKeyUpdate()
		.executeTakeFirst();
	if (row === undefined) throw new MontiError("NOT_FOUND", "No active media item has this id");
	return row;
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

/** `keys`를 지금 지울 임시 파일로 `loose_files`에 올린다. 이미 있는 키는 지울 시각만 지금으로 당긴다. */
export async function queueLooseFilesNow(ctx: WriteContext, keys: string[]): Promise<void> {
	if (keys.length === 0) return;
	const rows = [...new Set(keys)].sort().map((key) => ({ key, remove_after: sql<Date>`now()` }));
	await ctx.db
		.insertInto("loose_files")
		.values(rows)
		.onConflict((conflict) => conflict.column("key").doUpdateSet({ remove_after: sql<Date>`now()` }))
		.execute();
}
