import { MontiError } from "../../engine/errors";
import type { ReadContext } from "../../engine/types";
import type { Block } from "../../rich-text/types";
import { copyQuery, entriesOf, findEntry } from "../entries/read";
import type { Entry, EntryData } from "../entries/types";

/** 번역 언어 작업본의 `translation_seen`이 담는 것: 번역하는 사람이 확인한 원문 값을 그때 모습 그대로. */
export interface SeenRecord {
	/** 확인한 필드마다 그 원문 값. */
	fields: Record<string, unknown>;
	/** 확인한 원문 본문 블록마다 그 기록, 블록 `id`로. */
	blocks: Record<string, BlockSeen>;
}

/** 확인한 원문 본문 블록 하나: 번역 블록과 연결했거나 번역 제외로 표시했다. */
export interface BlockSeen {
	link?: string;
	exclude?: true;
	seen_value: Block;
}

/** 활성 글의 번역 언어 작업본 하나와 그 글의 원문 작업본의 필드 값·본문. */
export interface TranslationRow {
	id: string;
	collection: string;
	locale: string;
	source_locale: string;
	source: EntryData;
	data: EntryData;
	/** 아무것도 확인하지 않았으면 비어 있다(`{}`). */
	translation_seen: Partial<SeenRecord>;
}

/** 번역 언어 작업본을 거르는 조건. 주지 않은 조건은 거르지 않는다. */
interface TranslationFilter {
	id?: string;
	locale?: string;
}

/** 컬렉션 `name`에서 `ids` 글들의 원문 작업본을 글 `id`별로. */
async function sourcesOf(ctx: ReadContext, name: string, ids: string[]): Promise<Map<string, Entry>> {
	// `in ()`는 SQL이 아니다: 번역 언어가 없으면 읽을 원문도 없다.
	if (ids.length === 0) return new Map();
	const rows = await copyQuery(ctx, name, "draft")
		.whereRef("d.locale", "=", "e.source_locale")
		.where("e.id", "in", ids)
		.execute();
	return new Map((await entriesOf(ctx, name, rows)).map((entry) => [entry.id, entry]));
}

/**
 * 컬렉션 `name`(스키마에 있는 이름)의 활성 글들에서 `filter`에 맞는 원문이 아닌 언어의 작업본들. `name`은
 * `collectionOf`를 거친 것만 넘긴다.
 */
export async function translationRowsIn(
	ctx: ReadContext,
	name: string,
	filter: TranslationFilter,
): Promise<TranslationRow[]> {
	let query = copyQuery(ctx, name, "draft").whereRef("d.locale", "<>", "e.source_locale");
	if (filter.id !== undefined) query = query.where("e.id", "=", filter.id);
	if (filter.locale !== undefined) query = query.where("d.locale", "=", filter.locale);
	const rows = await query.execute();
	const translations = await entriesOf(ctx, name, rows);
	const sources = await sourcesOf(ctx, name, [...new Set(translations.map((entry) => entry.id))]);
	return translations.map((entry, index) => ({
		id: entry.id,
		collection: name,
		locale: entry.locale,
		source_locale: entry.source_locale,
		// 활성 글에는 늘 원문 작업본이 있다.
		source: sources.get(entry.id) as Entry,
		data: entry,
		translation_seen: rows[index].translation_seen as Partial<SeenRecord>,
	}));
}

/** 활성 글 하나의 번역 언어 작업본. 원문 언어는 거절하고, 글이 없거나 휴지통이거나 그 언어가 없으면 찾지 못한다. */
export async function findTranslation(ctx: ReadContext, key: { id: string; locale: string }): Promise<TranslationRow> {
	const entry = await findEntry(ctx, { id: key.id }, "draft");
	if (key.locale === entry.source_locale) throw new MontiError("BAD_REQUEST", "원문 언어에는 번역 상태가 없다");
	const [row] = await translationRowsIn(ctx, entry.collection, key);
	if (row === undefined) throw new MontiError("NOT_FOUND", "글에 이 언어가 없다");
	return row;
}

/** 행에 담긴 기록. 비어 있는 쪽은 아무것도 확인하지 않은 것으로 본다. */
export function seenOf(row: TranslationRow): SeenRecord {
	return { fields: row.translation_seen.fields ?? {}, blocks: row.translation_seen.blocks ?? {} };
}
