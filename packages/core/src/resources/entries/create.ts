import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { WriteContext } from "../../engine/types";
import { uuidInput } from "../_shared/input";
import { replaceEntryMediaUses } from "../media/uses";
import type { Entry } from "./query";
import { checkData, collectionOf, rejectFolder, rejectLocale, rejectTakenSlug } from "./validate";

export const slugInput = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const dataInput = z.object({
	fields: z.record(z.string(), z.unknown()).optional(),
	body: z.unknown().optional(),
});

export const folderInput = uuidInput.nullable();

export const createInput = z.object({
	__preset_id: uuidInput.optional(),
	collection: z.string(),
	locale: z.string(),
	slug: slugInput,
	folder_id: folderInput.optional(),
	data: dataInput.optional(),
});

/** Makes a new entry and its working copy in its source locale, `locale`, and indexes the media its data references. */
export async function createEntry(input: z.infer<typeof createInput>, ctx: WriteContext): Promise<Entry> {
	const collection = collectionOf(ctx, input.collection);
	rejectLocale(ctx, input.locale);
	const data = await checkData(ctx, collection, input.data ?? {});
	if (typeof input.folder_id === "string") await rejectFolder(ctx, input.folder_id, input.collection);
	const entry: Entry = {
		id: input.__preset_id ?? randomUUID(),
		collection: input.collection,
		locale: input.locale,
		source_locale: input.locale,
		folder_id: input.folder_id ?? null,
		slug: input.slug,
		data: { ...data },
		published_at: null,
	};
	await rejectTakenSlug(ctx, entry);
	const { id, collection: name, source_locale, folder_id, locale, slug } = entry;
	await ctx.db.insertInto("entries").values({ id, collection: name, source_locale, folder_id }).execute();
	await ctx.db
		.insertInto("entry_locales")
		.values({ entry_id: id, locale, slug, data: JSON.stringify(data), translation_seen: JSON.stringify({}) })
		.execute();
	await replaceEntryMediaUses(ctx, id, collection, data);
	return entry;
}
