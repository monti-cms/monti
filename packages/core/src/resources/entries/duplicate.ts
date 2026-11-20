import { z } from "zod";
import type { WriteContext } from "../../engine/types";
import { uuidInput } from "../_shared/input";
import { firstFree } from "../_shared/names";
import { createEntry, slugInput } from "./create";
import { type Entry, findEntry } from "./query";

export const duplicateInput = z.object({
	id: uuidInput,
	slug: slugInput.optional(),
	__preset_id: uuidInput.optional(),
});

/** The first of `base`, `<base>-2`, `<base>-3`… no active entry of `collection` has in `locale`. */
export async function freeSlug(ctx: WriteContext, owner: Pick<Entry, "collection" | "locale">, base: string) {
	const rows = await ctx.db
		.selectFrom("entry_locales")
		.innerJoin("entries", "entries.id", "entry_locales.entry_id")
		.select("entry_locales.slug")
		.where("entries.collection", "=", owner.collection)
		.where("entries.trashed_at", "is", null)
		.where("entry_locales.locale", "=", owner.locale)
		.where("entry_locales.slug", "like", `${base}%`)
		.execute();
	return firstFree(base, new Set(rows.map((row) => row.slug)));
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
			slug: input.slug ?? (await freeSlug(ctx, source, `${source.slug}-copy`)),
			folder_id: source.folder_id,
			data: source.data,
		},
		ctx,
	);
}
