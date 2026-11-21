import { MontiError } from "../../engine/errors";
import type { CollectionSchema, ReadContext } from "../../engine/types";
import { activeIds, isIn, type References, referencesIn } from "./active";
import { collectionOf } from "./collection";
import { decodeData, everyTarget, type Stored } from "./decode";
import { type Row, tablesOf } from "./tables";
import type { Entry, EntryData, Status } from "./types";

/** `entries.get`이 읽는 글: `id`와 `locale`(생략하면 원문 언어)로, 또는 컬렉션·언어·슬러그로. */
export type EntryKey = { id: string; locale?: string } | { collection: string; locale: string; slug: string };

/**
 * 컬렉션 `name`의 활성 글들의 `status` 행(테이블 `d`)을 글(`e`)과 합친 조회. `live_at`은 같은 글·언어의 발행본이
 * 발행된 시각이다.
 */
export function copyQuery(ctx: ReadContext, name: string, status: Status) {
	return tablesOf(ctx.db)
		.selectFrom(`${name} as e`)
		.innerJoin(`${name}_data as d`, "d.entry_id", "e.id")
		.leftJoin(`${name}_data as p`, (join) =>
			join.onRef("p.entry_id", "=", "d.entry_id").onRef("p.locale", "=", "d.locale").on("p.status", "=", "published"),
		)
		.selectAll("d")
		.select(["e.source_locale", "e.folder_id", "p.published_at as live_at"])
		.where("e.trashed_at", "is", null)
		.where("d.status", "=", status);
}

/** `rows`의 `<collection>_rels` 행들을 행마다 `position` 순으로 묶는다. */
export async function storedOf(ctx: ReadContext, name: string, rows: Row[]): Promise<Stored[]> {
	const ids = [...new Set(rows.map((row) => String(row.entry_id)))];
	// `in ()`는 SQL이 아니다: 행이 없으면 묶을 것도 없다.
	const rels =
		ids.length === 0
			? []
			: await tablesOf(ctx.db)
					.selectFrom(`${name}_rels`)
					.selectAll()
					.where("entry_id", "in", ids)
					.orderBy("position")
					.execute();
	return rows.map((row) => ({
		row,
		rels: rels.filter((rel) => rel.entry_id === row.entry_id && rel.locale === row.locale && rel.status === row.status),
	}));
}

/** 저장된 행들의 필드 값과 본문. 휴지통에 있는 참조 대상은 빈칸으로 거른다. */
async function dataOf(ctx: ReadContext, collection: CollectionSchema, stored: Stored[]): Promise<EntryData[]> {
	const refs: References = new Map();
	for (const one of stored) referencesIn(collection, decodeData(collection, one, everyTarget).fields, refs);
	const isActive = isIn(await activeIds(ctx, refs));
	return stored.map((one) => decodeData(collection, one, isActive));
}

/** `copyQuery`가 읽은 행들을 돌려줄 글 모양으로 바꾼다. */
export async function entriesOf(ctx: ReadContext, name: string, rows: Row[]): Promise<Entry[]> {
	const stored = await storedOf(ctx, name, rows);
	const data = await dataOf(ctx, collectionOf(ctx, name), stored);
	return rows.map((row, index) => ({
		id: String(row.entry_id),
		collection: name,
		locale: String(row.locale),
		source_locale: String(row.source_locale),
		folder_id: row.folder_id as string | null,
		slug: row.slug as string | null,
		...data[index],
		published_at: row.live_at as Date | null,
	}));
}

/** `key`가 가리키는 글의 `status` 행. 없거나 휴지통에 있거나 그 언어가 없으면 거절한다. */
export async function findEntry(ctx: ReadContext, key: EntryKey, status: Status): Promise<Entry> {
	const names = "collection" in key ? [key.collection] : Object.keys(ctx.schema.collections);
	if ("collection" in key) collectionOf(ctx, key.collection);
	for (const name of names) {
		let query = copyQuery(ctx, name, status);
		query = "id" in key ? query.where("e.id", "=", key.id) : query.where("d.slug", "=", key.slug);
		query =
			key.locale === undefined
				? query.whereRef("d.locale", "=", "e.source_locale")
				: query.where("d.locale", "=", key.locale);
		const rows = await query.execute();
		if (rows.length > 0) return (await entriesOf(ctx, name, rows))[0];
	}
	throw new MontiError("NOT_FOUND", "글을 찾을 수 없다");
}
