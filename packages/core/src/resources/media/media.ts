import { randomUUID } from "node:crypto";
import { z } from "zod";
import { lockFolderScope } from "../../db/locks";
import type { MediaUsesTable } from "../../db/types";
import { MontiError } from "../../engine/errors";
import { defineRead, defineWrite } from "../../engine/operation";
import type { ReadContext, StorageAdapter, WriteContext } from "../../engine/types";
import { uuidInput } from "../_shared/input";
import {
	addLooseFile,
	itemOf,
	lockActiveMedia,
	lockStorageKey,
	MAX_INTEGER,
	type MediaItem,
	rejectFolder,
	rejectRegisteredKey,
	rejectUnissuedKey,
	removeLooseFile,
	SHOWN,
	statOf,
	storageOf,
} from "./queries";

/** 사람이 고치는 파일 정보: 표시 이름과 픽셀 크기. */
const fileInfoInput = {
	filename: z.string().min(1).optional(),
	width: z.number().int().positive().max(MAX_INTEGER).nullable().optional(),
	height: z.number().int().positive().max(MAX_INTEGER).nullable().optional(),
};

const startUploadInput = z.object({ mime_type: z.string(), size: z.number().int().nonnegative().max(MAX_INTEGER) });

/** 새 키로 업로드 티켓을 발급한다. 그 키는 `create`가 등록할 때까지 업로드 티켓으로 `loose_files`에서 기다린다. */
async function startUpload(input: z.infer<typeof startUploadInput>, ctx: WriteContext) {
	const storage = storageOf(ctx);
	const key = randomUUID();
	const ticket = await storage.ticket(key, { mime: input.mime_type, size: input.size });
	await addLooseFile(ctx, key, "upload");
	return { key, url: ticket.url, headers: ticket.headers };
}

const createInput = z.object({
	__preset_id: uuidInput.optional(),
	folder_id: uuidInput.nullable().optional(),
	key: z.string(),
	...fileInfoInput,
});

/**
 * 업로드 티켓으로 올라간 파일을 미디어로 등록한다. `mime_type`과 `size`는 스토리지의 값이고 `filename`을 생략하면 `key`다.
 * 키를 잠가 임시 파일 정리·같은 키의 등록과 겹치지 않게 한다. 이미 등록된 키는 `CONFLICT`, 발급받지 않았거나 삭제 대기 중인
 * 키는 `BAD_REQUEST`다. 폴더에 넣을 때는 `"media"` `scope` 잠금을 키보다 먼저 잡고 그 뒤에 폴더를 확인해, 겹친 폴더의
 * 휴지통 이동이 커밋된 뒤의 폴더를 본다. 영구 삭제와 같은 순서(`scope`, 키, 행)라 서로 기다리다 멈추지 않는다.
 */
async function createMedia(input: z.infer<typeof createInput>, ctx: WriteContext): Promise<MediaItem> {
	const storage = storageOf(ctx);
	if (typeof input.folder_id === "string") await lockFolderScope(ctx.db, "media");
	await lockStorageKey(ctx.db, input.key);
	await rejectRegisteredKey(ctx, input.key);
	await rejectUnissuedKey(ctx, input.key);
	const stat = await statOf(storage, input.key);
	if (typeof input.folder_id === "string") await rejectFolder(ctx, input.folder_id);
	const row = await ctx.db
		.insertInto("media")
		.values({
			id: input.__preset_id ?? randomUUID(),
			folder_id: input.folder_id ?? null,
			key: input.key,
			filename: input.filename ?? input.key,
			mime_type: stat.mime,
			size: stat.size,
			width: input.width ?? null,
			height: input.height ?? null,
		})
		.returning(SHOWN)
		.executeTakeFirstOrThrow();
	await removeLooseFile(ctx, input.key);
	return itemOf(row, storage);
}

const listInput = z.object({ folder_id: uuidInput.nullable().optional() });

/** The active media: all of them, those at the root (`folder_id: null`), or those directly in one folder. */
async function listMedia(input: z.infer<typeof listInput>, ctx: ReadContext): Promise<MediaItem[]> {
	const storage = storageOf(ctx);
	let query = ctx.db.selectFrom("media").select(SHOWN).where("trashed_at", "is", null);
	if (input.folder_id === null) query = query.where("folder_id", "is", null);
	if (typeof input.folder_id === "string") query = query.where("folder_id", "=", input.folder_id);
	const rows = await query.execute();
	return rows.map((row) => itemOf(row, storage));
}

const getInput = z.object({ id: uuidInput });

/** 미디어 1건과 그 미디어를 쓰는 곳들(`media_uses`). */
type MediaWithUses = MediaItem & { uses: Pick<MediaUsesTable, "source_kind" | "source_id" | "field_path">[] };

async function getMedia(input: z.infer<typeof getInput>, ctx: ReadContext): Promise<MediaWithUses> {
	const storage = storageOf(ctx);
	const row = await ctx.db
		.selectFrom("media")
		.select(SHOWN)
		.where("id", "=", input.id)
		.where("trashed_at", "is", null)
		.executeTakeFirst();
	if (row === undefined) throw new MontiError("NOT_FOUND", "No active media item has this id");
	const uses = await ctx.db
		.selectFrom("media_uses")
		.select(["source_kind", "source_id", "field_path"])
		.where("media_id", "=", input.id)
		.execute();
	return { ...itemOf(row, storage), uses };
}

const updateOneInput = z.strictObject({
	id: uuidInput,
	folder_id: uuidInput.nullable().optional(),
	key: z.string().optional(),
	...fileInfoInput,
});
const updateManyInput = z.strictObject({ ids: z.array(uuidInput).min(1), folder_id: uuidInput.nullable() });
const updateInput = z.union([updateOneInput, updateManyInput]);

/** 단건(`id`): 파일 정보를 고치거나 옮기거나 파일을 교체한다. 다건(`ids`): 한 폴더로 옮긴다. */
async function updateMedia(input: z.infer<typeof updateInput>, ctx: WriteContext): Promise<MediaItem | MediaItem[]> {
	return "ids" in input ? updateMany(input, ctx) : updateOne(input, ctx);
}

/**
 * 생략한 필드는 그대로다. 새 `key`는 업로드 티켓이어야 하고 그 파일의 `mime_type`과 `size`를 가져오며, 이전 키는 더는 쓰지
 * 않는 파일로 `loose_files`에서 기다린다. 새 키를 먼저 잠그고 미디어 행을 잠가, 같은 미디어의 동시 교체는 앞 교체가 끝난
 * 행을 보고 그 키를 임시 목록에 넣는다. 폴더를 바꿀 때(루트로 꺼낼 때도)는 `"media"` `scope` 잠금을 그보다 먼저 잡아,
 * 겹친 폴더의 휴지통 이동이 커밋된 뒤의 폴더와 미디어를 본다.
 */
async function updateOne(input: z.infer<typeof updateOneInput>, ctx: WriteContext): Promise<MediaItem> {
	const storage = storageOf(ctx);
	const { id, key, ...fields } = input;
	if (fields.folder_id !== undefined) await lockFolderScope(ctx.db, "media");
	if (key !== undefined) await lockStorageKey(ctx.db, key);
	const existing = await lockActiveMedia(ctx, id);
	if (typeof fields.folder_id === "string") await rejectFolder(ctx, fields.folder_id);
	const file = key !== undefined && key !== existing.key ? await fileOf(ctx, storage, key) : undefined;
	const changes = { ...fields, ...file };
	// 바꿀 값이 없으면 열 없는 `set`이 되어 SQL이 아니다. Kysely는 `undefined` 값을 `set`에서 뺀다.
	if (Object.values(changes).every((value) => value === undefined)) return itemOf(existing, storage);
	const row = await ctx.db
		.updateTable("media")
		.set(changes)
		.where("id", "=", id)
		.returning(SHOWN)
		.executeTakeFirstOrThrow();
	// 키 교체는 DB 고유 제약을 통과한 뒤에만 임시 목록에 반영한다.
	if (file !== undefined) {
		await removeLooseFile(ctx, file.key);
		await addLooseFile(ctx, existing.key, "cleanup");
	}
	return itemOf(row, storage);
}

/**
 * 업로드 티켓으로 올라간 새 파일을 확인하고 파일과 함께 바뀌는 열들을 돌려준다. 등록과 같은 순서로 거절한다: 다른 미디어가
 * 이미 쓰는 키는 `CONFLICT`, 발급받지 않았거나 삭제 대기 중인 키는 `BAD_REQUEST`다.
 */
async function fileOf(
	ctx: WriteContext,
	storage: StorageAdapter,
	key: string,
): Promise<{ key: string; mime_type: string; size: number }> {
	await rejectRegisteredKey(ctx, key);
	await rejectUnissuedKey(ctx, key);
	const stat = await statOf(storage, key);
	return { key, mime_type: stat.mime, size: stat.size };
}

/**
 * `ids`를 모두 옮기거나 하나도 옮기지 않는다: 없거나 휴지통에 있는 것이 하나라도 있으면 이동 전체를 거절한다. `"media"`
 * `scope` 잠금 아래에서 폴더를 확인하고 아직 활성인 행만 옮겨, 겹친 폴더의 휴지통 이동·다른 다건 이동이 커밋된 뒤의 상태를
 * 본다.
 */
async function updateMany(input: z.infer<typeof updateManyInput>, ctx: WriteContext): Promise<MediaItem[]> {
	const storage = storageOf(ctx);
	await lockFolderScope(ctx.db, "media");
	if (input.folder_id !== null) await rejectFolder(ctx, input.folder_id);
	const ids = [...new Set(input.ids)];
	const rows = await ctx.db
		.updateTable("media")
		.set({ folder_id: input.folder_id })
		.where("id", "in", ids)
		.where("trashed_at", "is", null)
		.returning(SHOWN)
		.execute();
	if (rows.length !== ids.length) throw new MontiError("NOT_FOUND", "활성 미디어가 아닌 `id`가 있다");
	return rows.map((row) => itemOf(row, storage));
}

/** `media` 리소스: 스토리지에 올라간 파일과 그 파일 정보. */
export const media = {
	startUpload: defineWrite({ input: startUploadInput, run: startUpload }),
	create: defineWrite({ input: createInput, run: createMedia }),
	list: defineRead({ input: listInput, run: listMedia }),
	get: defineRead({ input: getInput, run: getMedia }),
	update: defineWrite({ input: updateInput, run: updateMedia }),
};
