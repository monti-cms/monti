import { z } from "zod";
import type { ReadContext } from "../../engine/types";
import { uuidInput } from "../_shared/input";
import { collectionOf } from "../entries/collection";
import { translationRowsIn } from "./rows";
import { type Status, statusOf, type TranslationStatus } from "./status";

export const listInput = z.object({
	id: uuidInput.optional(),
	collection: z.string().optional(),
	locale: z.string().optional(),
});

/** 활성 글의 번역 언어 하나와, 그 필드·본문 블록 가운데 원문 변경·미확인 상태의 개수. */
interface StatusCount {
	id: string;
	collection: string;
	locale: string;
	source_locale: string;
	outdated_count: number;
	unseen_count: number;
}

/** 주어진 조건을 모두 만족하는 활성 글의 번역 언어마다 한 줄. */
export async function listStatus(input: z.infer<typeof listInput>, ctx: ReadContext): Promise<StatusCount[]> {
	const names = input.collection === undefined ? Object.keys(ctx.schema.collections) : [input.collection];
	if (input.collection !== undefined) collectionOf(ctx, input.collection);
	const counts: StatusCount[] = [];
	for (const name of names) {
		const rows = await translationRowsIn(ctx, name, input);
		counts.push(...rows.map((row) => countOf(statusOf(ctx, row))));
	}
	return counts;
}

function countOf(status: TranslationStatus): StatusCount {
	const { id, collection, locale, source_locale, fields, blocks } = status;
	const statuses = [...Object.values(fields), ...blocks].map((unit) => unit.status);
	const count = (wanted: Status) => statuses.filter((found) => found === wanted).length;
	return { id, collection, locale, source_locale, outdated_count: count("outdated"), unseen_count: count("unseen") };
}
