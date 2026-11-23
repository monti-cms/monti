import { sql } from "kysely";
import type { CollectionSchema, Schema, WriteContext } from "../../engine/types";
import { isMany, slotsOf } from "../entries/slots";
import { collectionsInDatabase } from "./database-catalog";

/** 컬렉션의 `<collection>_rels`에 담기는 다건 참조 경로들(`_rels.path`이자 `media_uses.field_path`). */
function relsPathsOf(collection: CollectionSchema): string[] {
	return slotsOf(collection)
		.filter((slot) => isMany(slot.field))
		.map((slot) => slot.path);
}

/** 두 스키마에 모두 있는 컬렉션마다 새 스키마에서 사라진 다건 참조 경로. 사라진 것이 없는 컬렉션은 뺀다. */
function removedPaths(prev: Schema, next: Schema): [string, string[]][] {
	const before = new Map(Object.entries(prev.collections));
	return Object.entries(next.collections).flatMap(([key, collection]): [string, string[]][] => {
		const kept = relsPathsOf(collection);
		const removed = relsPathsOf(before.get(key) ?? { fields: {} }).filter((path) => !kept.includes(path));
		return removed.length === 0 ? [] : [[key, removed]];
	});
}

/** `prev`에서 `next`로 바꾸며 지운 다건 참조 필드의 `<collection>_rels` 행과, 그 경로를 가리키는 글의 `media_uses` 행을 지운다. */
export async function removeRelsPaths(ctx: WriteContext, prev: Schema, next: Schema): Promise<void> {
	for (const [key, paths] of removedPaths(prev, next)) {
		await sql`delete from ${sql.table(`${key}_rels`)} where path in (${sql.join(paths)})`.execute(ctx.db);
		await ctx.db
			.deleteFrom("media_uses")
			.where("source_kind", "=", "entry")
			.where("field_path", "in", paths)
			.where(sql<boolean>`source_id in (select id from ${sql.table(key)})`)
			.execute();
	}
}

/**
 * `next`에 없어 동기화가 지울 컬렉션(DB에 있는 컬렉션 테이블 중 `next`에 없는 것)의 글을 가리키는 `media_uses` 행을 지운다.
 * 동기화가 지울 테이블과 같은 목록이다. 컬렉션 테이블이 지워지기 전에 불러야 그 글의 `id`를 읽을 수 있다.
 */
export async function removeDroppedUses(ctx: WriteContext, next: Schema): Promise<void> {
	const dropped = (await collectionsInDatabase(ctx.db)).filter((key) => !Object.hasOwn(next.collections, key));
	for (const key of dropped) {
		await ctx.db
			.deleteFrom("media_uses")
			.where("source_kind", "=", "entry")
			.where(sql<boolean>`source_id in (select id from ${sql.table(key)})`)
			.execute();
	}
}
