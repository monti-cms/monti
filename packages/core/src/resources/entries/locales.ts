import { z } from "zod";
import { MontiError } from "../../engine/errors";
import type { WriteContext } from "../../engine/types";
import { collectionOf, rejectLocale } from "../_shared/collection";
import { uuidInput } from "../_shared/input";
import { recountEntryMediaUses } from "../media/uses";
import { saveCopy } from "./copies";
import { dataShape, type entryLocaleInput, slugInput } from "./inputs";
import { findEntry } from "./read";
import { tablesOf } from "./tables";
import type { Entry } from "./types";
import { checkData, rejectTakenSlug } from "./validate";

export const addLocaleInput = z.object({
	id: uuidInput,
	locale: z.string(),
	slug: slugInput.optional(),
	...dataShape,
});

/** 글에 이미 그 언어 작업본이 있으면 거절한다. */
async function rejectExistingLocale(ctx: WriteContext, entry: Entry, locale: string): Promise<void> {
	const existing = await tablesOf(ctx.db)
		.selectFrom(`${entry.collection}_data`)
		.select("locale")
		.where("entry_id", "=", entry.id)
		.where("locale", "=", locale)
		.executeTakeFirst();
	if (existing !== undefined) throw new MontiError("CONFLICT", "글에 이미 이 언어가 있다");
}

/**
 * 활성 글에 아직 없는 언어의 작업본을 더하고 모든 언어 기준으로 미디어 사용처를 다시 센다. 슬러그를 생략하면 원문
 * 언어 작업본의 슬러그를 쓴다.
 */
export async function addLocale(input: z.infer<typeof addLocaleInput>, ctx: WriteContext): Promise<Entry> {
	rejectLocale(ctx, input.locale);
	const source = await findEntry(ctx, { id: input.id }, "draft");
	const { id, collection: name } = source;
	const collection = collectionOf(ctx, name);
	const data = await checkData(ctx, collection, input);
	await rejectExistingLocale(ctx, source, input.locale);
	const slug = input.slug === undefined ? source.slug : input.slug;
	await rejectTakenSlug(ctx, name, { id, locale: input.locale, slug }, "draft");
	await saveCopy(ctx, name, collection, { entry_id: id, locale: input.locale, status: "draft" }, { slug, data });
	await recountEntryMediaUses(ctx, name, collection, id);
	return findEntry(ctx, { id, locale: input.locale }, "draft");
}

/**
 * 활성 글의 원문이 아닌 언어를 발행본과 함께 바로 지우고 남은 언어 기준으로 미디어 사용처를 다시 센다. 원문 언어는
 * 지울 수 없다.
 */
export async function removeLocale(input: z.infer<typeof entryLocaleInput>, ctx: WriteContext) {
	const entry = await findEntry(ctx, { id: input.id }, "draft");
	if (input.locale === entry.source_locale) throw new MontiError("BAD_REQUEST", "원문 언어는 지울 수 없다");
	const removed = await tablesOf(ctx.db)
		.deleteFrom(`${entry.collection}_data`)
		.where("entry_id", "=", entry.id)
		.where("locale", "=", input.locale)
		.returning("locale")
		.execute();
	if (removed.length === 0) throw new MontiError("NOT_FOUND", "글에 이 언어가 없다");
	await recountEntryMediaUses(ctx, entry.collection, collectionOf(ctx, entry.collection), entry.id);
	return { id: entry.id, locale: input.locale };
}

/**
 * 활성 글에 이미 있는 언어 하나를 원문 언어로 삼고 모든 언어 작업본의 `translation_seen`을 비운다. 이미 원문 언어면
 * 그대로 돌려준다.
 */
export async function setSourceLocale(input: z.infer<typeof entryLocaleInput>, ctx: WriteContext): Promise<Entry> {
	const entry = await findEntry(ctx, { id: input.id, locale: input.locale }, "draft");
	if (entry.source_locale === input.locale) return entry;
	const db = tablesOf(ctx.db);
	await db.updateTable(entry.collection).set({ source_locale: input.locale }).where("id", "=", entry.id).execute();
	await db
		.updateTable(`${entry.collection}_data`)
		.set({ translation_seen: JSON.stringify({}) })
		.where("entry_id", "=", entry.id)
		.where("status", "=", "draft")
		.execute();
	return { ...entry, source_locale: input.locale };
}
