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

/** 미디어의 정수 열(`size`, `width`, `height`)이 담을 수 있는 가장 큰 값: PostgreSQL `integer`의 최대값. */
export const MAX_INTEGER = 2_147_483_647;

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

/** 올라간 `key`의 파일. 파일이 없거나 크기가 `0` 이상 `MAX_INTEGER` 이하의 정수가 아니면 거절한다. */
export async function statOf(storage: StorageAdapter, key: string): Promise<{ mime: string; size: number }> {
	const stat = await storage.stat(key);
	if (stat === null) throw new MontiError("BAD_REQUEST", "No uploaded file has this key");
	if (!Number.isInteger(stat.size) || stat.size < 0 || stat.size > MAX_INTEGER) {
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
	if (row === undefined) throw new MontiError("NOT_FOUND", "이 id의 활성 미디어가 없다");
	return row;
}

/** `"media"` 범위의 활성 폴더가 아니면 거절한다. */
export async function rejectFolder(ctx: WriteContext, folderId: string): Promise<void> {
	if (!(await isActiveFolder(ctx, folderId, "media"))) {
		throw new MontiError("BAD_REQUEST", "The folder is not an active media folder");
	}
}

/** `key`를 `kind`(업로드 티켓 `"upload"` 또는 더는 쓰지 않는 파일 `"cleanup"`)로 `loose_files`에 올려 24시간 뒤 지우게 한다. */
export async function addLooseFile(ctx: WriteContext, key: string, kind: "upload" | "cleanup"): Promise<void> {
	const remove_after = new Date(Date.now() + LOOSE_FOR_MS);
	await ctx.db
		.insertInto("loose_files")
		.values({ key, kind, remove_after })
		.onConflict((conflict) => conflict.column("key").doUpdateSet({ kind, remove_after }))
		.execute();
}

/** 이미 미디어(휴지통 포함)로 등록된 `key`면 거절한다. */
export async function rejectRegisteredKey(ctx: WriteContext, key: string): Promise<void> {
	const row = await ctx.db.selectFrom("media").select("id").where("key", "=", key).executeTakeFirst();
	if (row !== undefined) throw new MontiError("CONFLICT", "이미 등록된 파일 키다");
}

/** `media.startUpload`가 발급해 아직 등록되지 않은 업로드 티켓 키가 아니면 거절한다. 삭제 대기 중인 이전 키도 거절한다. */
export async function rejectUnissuedKey(ctx: WriteContext, key: string): Promise<void> {
	const ticket = await ctx.db
		.selectFrom("loose_files")
		.select("key")
		.where("key", "=", key)
		.where("kind", "=", "upload")
		.executeTakeFirst();
	if (ticket === undefined) throw new MontiError("BAD_REQUEST", "업로드 시작으로 발급받은 파일 키가 아니다");
}

/** Takes `key` out of `loose_files`: something uses its file now. */
export async function removeLooseFile(ctx: WriteContext, key: string): Promise<void> {
	await ctx.db.deleteFrom("loose_files").where("key", "=", key).execute();
}

/** `keys`를 지금 지울 임시 파일로 `loose_files`에 올린다. 이미 있는 키는 지울 시각을 지금으로 맞춘다. */
export async function queueLooseFilesNow(ctx: WriteContext, keys: string[]): Promise<void> {
	if (keys.length === 0) return;
	const rows = [...keys].sort().map((key) => ({ key, kind: "cleanup" as const, remove_after: sql<Date>`now()` }));
	await ctx.db
		.insertInto("loose_files")
		.values(rows)
		.onConflict((conflict) => conflict.column("key").doUpdateSet({ kind: "cleanup", remove_after: sql<Date>`now()` }))
		.execute();
}
