import { z } from "zod";
import type { WriteContext } from "../../engine/types";
import { uuidInput } from "../_shared/input";
import { createEntry, slugInput } from "./create";
import { type Entry, findEntry } from "./query";

export const duplicateInput = z.object({
	id: uuidInput,
	slug: slugInput.optional(),
	__preset_id: uuidInput.optional(),
});

/** The first of `<slug>-copy`, `<slug>-copy-2`, `<slug>-copy-3`… no active entry of the collection has in the locale. */
async function copySlug(ctx: WriteContext, entry: Entry): Promise<string> {
	const base = `${entry.slug}-copy`;
	const rows = await ctx.db
		.selectFrom("entry_locales")
		.innerJoin("entries", "entries.id", "entry_locales.entry_id")
		.select("entry_locales.slug")
		.where("entries.collection", "=", entry.collection)
		.where("entries.trashed_at", "is", null)
		.where("entry_locales.locale", "=", entry.locale)
		.where("entry_locales.slug", "like", `${base}%`)
		.execute();
	const taken = new Set(rows.map((row) => row.slug));
	let slug = base;
	for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
	return slug;
}

/**
 * Copies an active entry's working copy in its source locale into a new unpublished entry, checked and indexed as a
 * create is; its other locales are not copied.
 */
export async function duplicateEntry(input: z.infer<typeof duplicateInput>, ctx: WriteContext): Promise<Entry> {
	const source = await findEntry(ctx, { id: input.id }, true);
	return createEntry(
		{
			__preset_id: input.__preset_id,
			collection: source.collection,
			locale: source.locale,
			slug: input.slug ?? (await copySlug(ctx, source)),
			folder_id: source.folder_id,
			data: source.data,
		},
		ctx,
	);
}
