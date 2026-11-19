import { z } from "zod";
import { MontiError } from "../../engine/errors";
import type { WriteContext } from "../../engine/types";
import { uuidInput } from "../_shared/input";
import { replaceEntryMediaUses } from "../media/uses";
import { dataInput, folderInput, slugInput } from "./create";
import { type Entry, findEntry } from "./query";
import { checkData, collectionOf, rejectFolder, rejectTakenSlug } from "./validate";

const updateOneInput = z.object({
	id: uuidInput,
	locale: z.string().optional(),
	slug: slugInput.optional(),
	folder_id: folderInput.optional(),
	data: dataInput.optional(),
});

const moveInput = z.object({ ids: z.array(uuidInput).nonempty(), folder_id: folderInput });

export const updateInput = z.union([updateOneInput, moveInput]);

/**
 * Changes the slug and data of an active entry's working copy in `locale` (its source locale when left out) and the
 * folder of the whole entry. New data is checked and the entry's `media_uses` are counted again over all its locales;
 * the published copies are kept.
 */
async function updateOne(input: z.infer<typeof updateOneInput>, ctx: WriteContext): Promise<Entry> {
	const existing = await findEntry(ctx, { id: input.id, locale: input.locale }, true);
	const collection = input.data === undefined ? undefined : collectionOf(ctx, existing.collection);
	const data = collection && input.data && (await checkData(ctx, collection, input.data));
	if (typeof input.folder_id === "string") await rejectFolder(ctx, input.folder_id, existing.collection);
	const slug = input.slug ?? existing.slug;
	await rejectTakenSlug(ctx, { ...existing, slug });
	await ctx.db
		.updateTable("entry_locales")
		.set({ slug, data: data && JSON.stringify(data) })
		.where("entry_id", "=", existing.id)
		.where("locale", "=", existing.locale)
		.execute();
	if (input.folder_id !== undefined) {
		await ctx.db.updateTable("entries").set({ folder_id: input.folder_id }).where("id", "=", existing.id).execute();
	}
	if (collection && data) await replaceEntryMediaUses(ctx, existing.id, collection, data);
	return findEntry(ctx, { id: existing.id, locale: existing.locale }, true);
}

/** Moves active entries into one active folder of their collection, or to the root with `folder_id: null`. */
async function moveEntries(input: z.infer<typeof moveInput>, ctx: WriteContext) {
	const ids = [...new Set(input.ids)];
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

/** One entry's working copy by `id`, or a move of many entries by `ids`. */
export async function updateEntries(input: z.infer<typeof updateInput>, ctx: WriteContext) {
	return "ids" in input ? moveEntries(input, ctx) : updateOne(input, ctx);
}
