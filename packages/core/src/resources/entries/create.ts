import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { WriteContext } from "../../engine/types";
import { collectionOf, rejectLocale } from "../_shared/collection";
import { uuidInput } from "../_shared/input";
import { recountEntryMediaUses } from "../media/uses";
import { saveCopy } from "./copies";
import { dataShape, folderInput, slugInput } from "./inputs";
import { findEntry } from "./read";
import { tablesOf } from "./tables";
import type { Entry } from "./types";
import { checkData, rejectFolder, rejectTakenSlug } from "./validate";

export const createInput = z.object({
	__preset_id: uuidInput.optional(),
	collection: z.string(),
	locale: z.string(),
	slug: slugInput.optional(),
	folder_id: folderInput.optional(),
	...dataShape,
});

/** 새 글과 그 원문 언어(`locale`) 작업본을 만들고, 그 글이 참조하는 미디어를 사용처에 기록한다. */
export async function createEntry(input: z.infer<typeof createInput>, ctx: WriteContext): Promise<Entry> {
	const name = input.collection;
	const collection = collectionOf(ctx, name);
	rejectLocale(ctx, input.locale);
	const data = await checkData(ctx, collection, input);
	const folder_id = input.folder_id ?? null;
	if (folder_id !== null) await rejectFolder(ctx, folder_id, name);
	const id = input.__preset_id ?? randomUUID();
	const slug = input.slug ?? null;
	await rejectTakenSlug(ctx, name, { id, locale: input.locale, slug }, "draft");
	await tablesOf(ctx.db).insertInto(name).values({ id, source_locale: input.locale, folder_id }).execute();
	await saveCopy(ctx, name, collection, { entry_id: id, locale: input.locale, status: "draft" }, { slug, data });
	await recountEntryMediaUses(ctx, name, collection, id);
	return findEntry(ctx, { id, locale: input.locale }, "draft");
}
