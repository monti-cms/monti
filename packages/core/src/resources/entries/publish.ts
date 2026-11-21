import { z } from "zod";
import { MontiError } from "../../engine/errors";
import type { FieldSchema, WriteContext } from "../../engine/types";
import { timestampInput, uuidInput } from "../_shared/input";
import { referencesOf, rejectInactive } from "./active";
import { collectionOf } from "./collection";
import { saveCopy } from "./copies";
import { findEntry } from "./read";
import type { ConditionalValue } from "./slots";
import { tablesOf } from "./tables";
import type { Entry } from "./types";
import { rejectTakenSlug } from "./validate";

export const publishInput = z.object({
	id: uuidInput,
	locale: z.string().optional(),
	published_at: timestampInput.optional(),
});

export const unpublishInput = z.object({ id: uuidInput, locale: z.string().optional() });

/** 비어 있는 값인지: 없거나 빈 문자열이나 빈 목록. `0`과 `false`는 채워진 값이다. */
function isEmpty(value: unknown): boolean {
	return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

/** `values`가 비워 둔 필수 필드의 경로. 선택한 분기의 필수 하위 필드도 본다. */
function emptyRequired(fields: Record<string, FieldSchema>, values: Record<string, unknown>, prefix = "fields") {
	return Object.entries(fields).flatMap(([key, field]): string[] => {
		const value = values[key];
		const path = `${prefix}.${key}`;
		if (isEmpty(value)) return field.required ? [path] : [];
		if (field.type !== "conditional") return [];
		const chosen = value as ConditionalValue;
		return emptyRequired(field.options[chosen.option].fields, chosen.fields, `${path}.fields`);
	});
}

/**
 * 슬러그나 필수 필드가 비어 있거나, 필드(필수 여부와 관계없이)나 본문이 없는 대상이나 휴지통에 있는 대상을 참조하면
 * 거절한다. 작업본은 휴지통에 있는 참조도 거르지 않고 읽으므로 여기서 모두 검사한다.
 */
async function rejectUnfilled(ctx: WriteContext, entry: Entry): Promise<void> {
	if (entry.slug === null) throw new MontiError("BAD_REQUEST", "슬러그가 비어 있어 발행할 수 없다");
	const collection = collectionOf(ctx, entry.collection);
	const empty = emptyRequired(collection.fields, entry.fields);
	if (empty.length > 0) throw new MontiError("BAD_REQUEST", `필수 필드가 비어 있다: ${empty.join(", ")}`);
	await rejectInactive(ctx, referencesOf(collection, entry));
}

/**
 * 활성 글의 `locale`(생략하면 원문 언어) 작업본을 그 언어의 발행본으로 저장한다. `published_at`을 생략하면 처음
 * 발행은 지금, 다시 발행은 이미 발행된 시각이다.
 */
export async function publishEntry(input: z.infer<typeof publishInput>, ctx: WriteContext): Promise<Entry> {
	const entry = await findEntry(ctx, { id: input.id, locale: input.locale }, "draft");
	const { id, locale, collection: name, slug } = entry;
	await rejectUnfilled(ctx, entry);
	await rejectTakenSlug(ctx, name, { id, locale, slug }, "published");
	const published_at = input.published_at ?? entry.published_at ?? new Date();
	const key = { entry_id: id, locale, status: "published" as const };
	await saveCopy(ctx, name, collectionOf(ctx, name), key, { slug, data: entry, published_at });
	return findEntry(ctx, { id, locale }, "published");
}

/** 활성 글의 `locale`(생략하면 원문 언어) 발행본이 있으면 지우고 작업본을 돌려준다. */
export async function unpublishEntry(input: z.infer<typeof unpublishInput>, ctx: WriteContext): Promise<Entry> {
	const entry = await findEntry(ctx, { id: input.id, locale: input.locale }, "draft");
	await tablesOf(ctx.db)
		.deleteFrom(`${entry.collection}_data`)
		.where("entry_id", "=", entry.id)
		.where("locale", "=", entry.locale)
		.where("status", "=", "published")
		.execute();
	return { ...entry, published_at: null };
}
