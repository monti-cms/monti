import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MontiError } from "../../engine/errors";
import { defineRead, defineWrite } from "../../engine/operation";
import type { ReadContext, WriteContext } from "../../engine/types";
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

const metadataInput = z.record(z.string(), z.unknown());

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
	__preset_id: z.uuid().optional(),
	folder_id: z.uuid().nullable().optional(),
	key: z.string(),
	metadata: metadataInput.optional(),
});

/** Registers an uploaded file as a media item; its `mime_type` is the storage's. */
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
			mime_type: stat.mime,
			metadata: JSON.stringify(input.metadata ?? {}),
		})
		.returning(SHOWN)
		.executeTakeFirstOrThrow();
	await removeLooseFile(ctx, input.key);
	return itemOf(row, storage);
}

const listInput = z.object({ folder_id: z.uuid().nullable().optional() });

/** The active media: all of them, those at the root (`folder_id: null`), or those directly in one folder. */
async function listMedia(input: z.infer<typeof listInput>, ctx: ReadContext): Promise<MediaItem[]> {
	const storage = storageOf(ctx);
	let query = ctx.db.selectFrom("media").select(SHOWN).where("trashed_at", "is", null);
	if (input.folder_id === null) query = query.where("folder_id", "is", null);
	if (typeof input.folder_id === "string") query = query.where("folder_id", "=", input.folder_id);
	const rows = await query.execute();
	return rows.map((row) => itemOf(row, storage));
}

const getInput = z.object({ id: z.uuid() });

async function getMedia(input: z.infer<typeof getInput>, ctx: ReadContext): Promise<MediaItem> {
	const storage = storageOf(ctx);
	const row = await ctx.db
		.selectFrom("media")
		.select(SHOWN)
		.where("id", "=", input.id)
		.where("trashed_at", "is", null)
		.executeTakeFirst();
	if (row === undefined) throw new MontiError("NOT_FOUND", "No active media item has this id");
	return itemOf(row, storage);
}

const updateOneInput = z.strictObject({
	id: z.uuid(),
	folder_id: z.uuid().nullable().optional(),
	metadata: metadataInput.optional(),
	key: z.string().optional(),
});
const updateManyInput = z.strictObject({ ids: z.array(z.uuid()).min(1), folder_id: z.uuid().nullable() });
const updateInput = z.union([updateOneInput, updateManyInput]);

/** One item (`id`): replaces its metadata, moves it or replaces its file. Many (`ids`): moves them to one folder. */
async function updateMedia(input: z.infer<typeof updateInput>, ctx: WriteContext): Promise<MediaItem | MediaItem[]> {
	return "ids" in input ? updateMany(input, ctx) : updateOne(input, ctx);
}

/** Omitted fields stay; a new `key` takes its file's `mime_type` and the old key waits in `loose_files`. */
async function updateOne(input: z.infer<typeof updateOneInput>, ctx: WriteContext): Promise<MediaItem> {
	const storage = storageOf(ctx);
	const existing = await getMedia({ id: input.id }, ctx);
	if (typeof input.folder_id === "string") await rejectFolder(ctx, input.folder_id);
	const file =
		input.key !== undefined && input.key !== existing.key ? await replaceFile(ctx, input.key, existing.key) : {};
	const changes = {
		...(input.folder_id !== undefined && { folder_id: input.folder_id }),
		...(input.metadata !== undefined && { metadata: JSON.stringify(input.metadata) }),
		...file,
	};
	// An update with nothing to set would be `set` with no columns, which is not SQL.
	if (Object.keys(changes).length === 0) return existing;
	const row = await ctx.db
		.updateTable("media")
		.set(changes)
		.where("id", "=", input.id)
		.returning(SHOWN)
		.executeTakeFirstOrThrow();
	return itemOf(row, storage);
}

/** Checks the new file and swaps the keys in `loose_files`; returns the columns that change with the file. */
async function replaceFile(
	ctx: WriteContext,
	key: string,
	oldKey: string,
): Promise<{ key: string; mime_type: string }> {
	const stat = await statOf(storageOf(ctx), key);
	await rejectTakenKey(ctx, key);
	await removeLooseFile(ctx, key);
	await addLooseFile(ctx, oldKey);
	return { key, mime_type: stat.mime };
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

/** The `media` resource: uploaded files in the storage and their metadata. */
export const media = {
	startUpload: defineWrite({ input: startUploadInput, run: startUpload }),
	create: defineWrite({ input: createInput, run: createMedia }),
	list: defineRead({ input: listInput, run: listMedia }),
	get: defineRead({ input: getInput, run: getMedia }),
	update: defineWrite({ input: updateInput, run: updateMedia }),
};
