import { z } from "zod";
import { MontiError } from "../../engine/errors";
import type { WriteContext } from "../../engine/types";
import { uuidInput } from "../_shared/input";
import { recountEntryMediaUses, replaceEntryMediaUses } from "../media/uses";
import { dataInput, slugInput } from "./create";
import { type Entry, findEntry } from "./query";
import { checkData, collectionOf, rejectLocale, rejectTakenSlug } from "./validate";

export const addLocaleInput = z.object({
	id: uuidInput,
	locale: z.string(),
	slug: slugInput,
	data: dataInput.optional(),
});

export const removeLocaleInput = z.object({ id: uuidInput, locale: z.string() });

/**
 * Adds a working copy in a locale the entry does not have yet to an active entry, and counts the entry's `media_uses`
 * again over all its locales.
 */
export async function addLocale(input: z.infer<typeof addLocaleInput>, ctx: WriteContext): Promise<Entry> {
	rejectLocale(ctx, input.locale);
	const source = await findEntry(ctx, { id: input.id }, true);
	const collection = collectionOf(ctx, source.collection);
	const data = await checkData(ctx, collection, input.data ?? {});
	const entry: Entry = { ...source, locale: input.locale, slug: input.slug, data: { ...data }, published_at: null };
	await rejectTakenSlug(ctx, entry);
	const added = await ctx.db
		.insertInto("entry_locales")
		.values({
			entry_id: entry.id,
			locale: entry.locale,
			slug: entry.slug,
			data: JSON.stringify(data),
			translation_seen: JSON.stringify({}),
		})
		.onConflict((conflict) => conflict.columns(["entry_id", "locale"]).doNothing())
		.returning("locale")
		.executeTakeFirst();
	if (added === undefined) throw new MontiError("CONFLICT", "The entry already has this locale");
	await replaceEntryMediaUses(ctx, entry.id, collection, data);
	return entry;
}

/**
 * Deletes an active entry's working copy in a locale other than its source locale, and with it the published copy in
 * that locale; the entry's `media_uses` are counted again over the locales left. The locale need not be in the schema.
 */
export async function removeLocale(input: z.infer<typeof removeLocaleInput>, ctx: WriteContext) {
	const entry = await findEntry(ctx, { id: input.id }, true);
	if (input.locale === entry.source_locale) throw new MontiError("BAD_REQUEST", "The source locale cannot be removed");
	const removed = await ctx.db
		.deleteFrom("entry_locales")
		.where("entry_id", "=", entry.id)
		.where("locale", "=", input.locale)
		.returning("locale")
		.executeTakeFirst();
	if (removed === undefined) throw new MontiError("NOT_FOUND", "The entry does not have this locale");
	await recountEntryMediaUses(ctx, entry.id, collectionOf(ctx, entry.collection));
	return { id: entry.id, locale: input.locale };
}
