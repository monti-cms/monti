import { z } from "zod";
import type { ReadContext, WriteContext } from "../../engine/types";
import { uuidInput } from "../_shared/input";
import { firstFree } from "../_shared/names";
import { createEntry } from "./create";
import { slugInput } from "./inputs";
import { findEntry } from "./read";
import { tablesOf } from "./tables";
import type { Entry } from "./types";

export const duplicateInput = z.object({
	id: uuidInput,
	slug: slugInput.optional(),
	__preset_id: uuidInput.optional(),
});

/** 컬렉션 `name`의 활성 글 작업본이 `locale`에서 쓰지 않는 `base`, `<base>-2`, `<base>-3`… 가운데 첫 번째. */
export async function freeSlug(ctx: ReadContext, name: string, locale: string, base: string): Promise<string> {
	const rows = await tablesOf(ctx.db)
		.selectFrom(`${name}_data as d`)
		.innerJoin(`${name} as e`, "e.id", "d.entry_id")
		.select("d.slug")
		.where("e.trashed_at", "is", null)
		.where("d.locale", "=", locale)
		.where("d.status", "=", "draft")
		.where("d.slug", "like", `${base}%`)
		.execute();
	return firstFree(base, new Set(rows.map((row) => String(row.slug))));
}

/** 슬러그를 생략했을 때의 복제본 슬러그: 원본 슬러그에 겹치지 않는 `-copy`를 붙이고, 원본이 비었으면 비워 둔다. */
async function copySlug(ctx: WriteContext, source: Entry): Promise<string | null> {
	if (source.slug === null) return null;
	return freeSlug(ctx, source.collection, source.locale, `${source.slug}-copy`);
}

/** 활성 글의 원문 언어 작업본을 새 미발행 글로 복제한다. 생성과 같이 검사하고 기록하며, 다른 언어는 복제하지 않는다. */
export async function duplicateEntry(input: z.infer<typeof duplicateInput>, ctx: WriteContext): Promise<Entry> {
	const source = await findEntry(ctx, { id: input.id }, "draft");
	return createEntry(
		{
			__preset_id: input.__preset_id,
			collection: source.collection,
			locale: source.locale,
			slug: input.slug === undefined ? await copySlug(ctx, source) : input.slug,
			folder_id: source.folder_id,
			data: source.data,
		},
		ctx,
	);
}
