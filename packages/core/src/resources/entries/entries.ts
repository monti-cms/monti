import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MontiError } from "../../engine/errors";
import { defineRead, defineWrite } from "../../engine/operation";
import type { ReadContext, WriteContext } from "../../engine/types";
import { replaceEntryMediaUses } from "../media/uses";
import { type Entry, findEntry, listEntries } from "./query";
import { checkData, collectionOf, rejectFolder, rejectLocale, rejectTakenSlug } from "./validate";

const SHOWN = ["id", "collection", "locale", "source_entry_id", "folder_id", "slug", "data"] as const;

const slugInput = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const dataInput = z.object({ fields: z.record(z.string(), z.unknown()).optional(), body: z.unknown().optional() });

const folderInput = z.uuid().nullable();

const createInput = z.object({
	__preset_id: z.uuid().optional(),
	collection: z.string(),
	locale: z.string(),
	slug: slugInput,
	folder_id: folderInput.optional(),
	data: dataInput.optional(),
});

/** Makes the working copy of a new entry and indexes the media its data references. */
async function createEntry(input: z.infer<typeof createInput>, ctx: WriteContext): Promise<Entry> {
	const collection = collectionOf(ctx, input.collection);
	rejectLocale(ctx, input.locale);
	const data = await checkData(ctx, collection, input.data ?? {});
	if (typeof input.folder_id === "string") await rejectFolder(ctx, input.folder_id, input.collection);
	const entry = {
		id: input.__preset_id ?? randomUUID(),
		collection: input.collection,
		locale: input.locale,
		folder_id: input.folder_id ?? null,
		slug: input.slug,
	};
	await rejectTakenSlug(ctx, entry);
	await replaceEntryMediaUses(ctx, entry.id, collection, data);
	const row = await ctx.db
		.insertInto("entries")
		.values({ ...entry, data: JSON.stringify(data), translation_seen: JSON.stringify({}) })
		.returning(SHOWN)
		.executeTakeFirstOrThrow();
	return { ...row, published_at: null };
}

const draftInput = z.boolean().optional();

const getInput = z.union([
	z.object({ id: z.uuid(), draft: draftInput }),
	z.object({ collection: z.string(), locale: z.string(), slug: z.string(), draft: draftInput }),
]);

/** The published copy of an entry, or its working copy with `draft: true`. */
async function getEntry(input: z.infer<typeof getInput>, ctx: ReadContext): Promise<Entry> {
	const { draft, ...key } = input;
	return findEntry(ctx, key, draft);
}

const listInput = z.object({
	collection: z.string().optional(),
	locale: z.string().optional(),
	folder_id: folderInput.optional(),
	relation: z.object({ field: z.string(), id: z.uuid() }).optional(),
	draft: draftInput,
});

/** The published copies of the matching entries, or their working copies with `draft: true`. */
async function listAll(input: z.infer<typeof listInput>, ctx: ReadContext): Promise<Entry[]> {
	const { draft, ...filter } = input;
	return listEntries(ctx, filter, draft);
}

const updateOneInput = z.object({
	id: z.uuid(),
	slug: slugInput.optional(),
	folder_id: folderInput.optional(),
	data: dataInput.optional(),
});

const moveInput = z.object({ ids: z.array(z.uuid()).nonempty(), folder_id: folderInput });

const updateInput = z.union([updateOneInput, moveInput]);

/** Changes an active entry's slug, folder or data; new data replaces its `media_uses`, the published copy is kept. */
async function updateOne(input: z.infer<typeof updateOneInput>, ctx: WriteContext): Promise<Entry> {
	const existing = await findEntry(ctx, { id: input.id }, true);
	const collection = input.data === undefined ? undefined : collectionOf(ctx, existing.collection);
	const data = collection && input.data && (await checkData(ctx, collection, input.data));
	if (typeof input.folder_id === "string") await rejectFolder(ctx, input.folder_id, existing.collection);
	const slug = input.slug ?? existing.slug;
	await rejectTakenSlug(ctx, { ...existing, slug });
	await ctx.db
		.updateTable("entries")
		.set({ slug, folder_id: input.folder_id, data: data && JSON.stringify(data) })
		.where("id", "=", input.id)
		.execute();
	if (collection && data) await replaceEntryMediaUses(ctx, input.id, collection, data);
	return findEntry(ctx, { id: input.id }, true);
}

/** Moves active entries into one active folder of their collection, or to the root with `folder_id: null`. */
async function moveEntries(input: z.infer<typeof moveInput>, ctx: WriteContext) {
	const ids = [...new Set(input.ids.map((id) => id.toLowerCase()))];
	const found = await ctx.db
		.selectFrom("entries")
		.select("collection")
		.where("id", "in", ids)
		.where("trashed_at", "is", null)
		.execute();
	if (found.length !== ids.length) throw new MontiError("NOT_FOUND", "Not every id is an active entry");
	if (input.folder_id !== null) {
		for (const collection of new Set(found.map((row) => row.collection))) {
			await rejectFolder(ctx, input.folder_id, collection);
		}
	}
	return ctx.db
		.updateTable("entries")
		.set({ folder_id: input.folder_id })
		.where("id", "in", ids)
		.returning(["id", "folder_id"])
		.execute();
}

/** One entry by `id`, or a move of many by `ids`. */
async function updateEntries(input: z.infer<typeof updateInput>, ctx: WriteContext) {
	return "ids" in input ? moveEntries(input, ctx) : updateOne(input, ctx);
}

/** The `entries` resource: the working and published copies of every collection's entries. */
export const entries = {
	create: defineWrite({ input: createInput, run: createEntry }),
	get: defineRead({ input: getInput, run: getEntry }),
	list: defineRead({ input: listInput, run: listAll }),
	update: defineWrite({ input: updateInput, run: updateEntries }),
};
