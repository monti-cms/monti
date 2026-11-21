import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { MediaUsesTable } from "../../db/types";
import { MontiError } from "../../engine/errors";
import { defineRead, defineWrite } from "../../engine/operation";
import type { ReadContext, WriteContext } from "../../engine/types";
import { uuidInput } from "../_shared/input";
import {
	addLooseFile,
	itemOf,
	type MediaItem,
	rejectFolder,
	rejectTakenKey,
	removeLooseFile,
	SHOWN,
	statOf,
	storageOf,
} from "./queries";

/** 사람이 고치는 파일 정보: 표시 이름과 픽셀 크기. */
const fileInfoInput = {
	filename: z.string().optional(),
	width: z.number().int().positive().nullable().optional(),
	height: z.number().int().positive().nullable().optional(),
};

const startUploadInput = z.object({ mime_type: z.string(), size: z.number().int().nonnegative() });

/** Issues an upload ticket for a new key; the key waits in `loose_files` until `create` registers it. */
async function startUpload(input: z.infer<typeof startUploadInput>, ctx: WriteContext) {
	const storage = storageOf(ctx);
	const key = randomUUID();
	const ticket = await storage.ticket(key, { mime: input.mime_type, size: input.size });
	await addLooseFile(ctx, key);
	return { key, url: ticket.url, headers: ticket.headers };
}

const createInput = z.object({
	__preset_id: uuidInput.optional(),
	folder_id: uuidInput.nullable().optional(),
	key: z.string(),
	...fileInfoInput,
});

/** 올라간 파일을 미디어로 등록한다. `mime_type`과 `size`는 스토리지의 값이고 `filename`을 생략하면 `key`다. */
async function createMedia(input: z.infer<typeof createInput>, ctx: WriteContext): Promise<MediaItem> {
	const storage = storageOf(ctx);
	const stat = await statOf(storage, input.key);
	await rejectTakenKey(ctx, input.key);
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
	// 고칠 때는 표시 이름을 비울 수 없다.
	filename: z.string().min(1).optional(),
});
const updateManyInput = z.strictObject({ ids: z.array(uuidInput).min(1), folder_id: uuidInput.nullable() });
const updateInput = z.union([updateOneInput, updateManyInput]);

/** 단건(`id`): 파일 정보를 고치거나 옮기거나 파일을 교체한다. 다건(`ids`): 한 폴더로 옮긴다. */
async function updateMedia(input: z.infer<typeof updateInput>, ctx: WriteContext): Promise<MediaItem | MediaItem[]> {
	return "ids" in input ? updateMany(input, ctx) : updateOne(input, ctx);
}

/** 생략한 필드는 그대로다. 새 `key`는 그 파일의 `mime_type`과 `size`를 가져오고 이전 키는 `loose_files`에서 기다린다. */
async function updateOne(input: z.infer<typeof updateOneInput>, ctx: WriteContext): Promise<MediaItem> {
	const storage = storageOf(ctx);
	const { id, key, ...fields } = input;
	const existing = await getMedia({ id }, ctx);
	if (typeof fields.folder_id === "string") await rejectFolder(ctx, fields.folder_id);
	const file = key !== undefined && key !== existing.key ? await replaceFile(ctx, key, existing.key) : {};
	const changes = { ...fields, ...file };
	// 바꿀 값이 없으면 열 없는 `set`이 되어 SQL이 아니다. Kysely는 `undefined` 값을 `set`에서 뺀다.
	if (Object.values(changes).every((value) => value === undefined)) {
		const { uses, ...item } = existing;
		return item;
	}
	const row = await ctx.db
		.updateTable("media")
		.set(changes)
		.where("id", "=", id)
		.returning(SHOWN)
		.executeTakeFirstOrThrow();
	return itemOf(row, storage);
}

/** Checks the new file and swaps the keys in `loose_files`; returns the columns that change with the file. */
async function replaceFile(
	ctx: WriteContext,
	key: string,
	oldKey: string,
): Promise<{ key: string; mime_type: string; size: number }> {
	const stat = await statOf(storageOf(ctx), key);
	await rejectTakenKey(ctx, key);
	await removeLooseFile(ctx, key);
	await addLooseFile(ctx, oldKey);
	return { key, mime_type: stat.mime, size: stat.size };
}

/** Moves every one of `ids` or none: a missing or trashed one rejects the whole move. */
async function updateMany(input: z.infer<typeof updateManyInput>, ctx: WriteContext): Promise<MediaItem[]> {
	const storage = storageOf(ctx);
	if (input.folder_id !== null) await rejectFolder(ctx, input.folder_id);
	const ids = [...new Set(input.ids)];
	const active = await ctx.db
		.selectFrom("media")
		.select("id")
		.where("id", "in", ids)
		.where("trashed_at", "is", null)
		.execute();
	if (active.length !== ids.length) throw new MontiError("NOT_FOUND", "Some of the ids are not active media items");
	const rows = await ctx.db
		.updateTable("media")
		.set({ folder_id: input.folder_id })
		.where("id", "in", ids)
		.returning(SHOWN)
		.execute();
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
