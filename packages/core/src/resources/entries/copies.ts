import type { CollectionSchema, WriteContext } from "../../engine/types";
import { encodeData } from "./encode";
import { tablesOf } from "./tables";
import type { CopyKey, EntryData } from "./types";

/** 한 언어·상태에 저장할 것. */
export interface CopyValues {
	slug: string | null;
	data: EntryData;
	published_at?: Date | string | null;
}

/**
 * 글 한 언어·상태의 `<collection>_data` 행을 만들거나 통째로 바꾸고, 그 키의 `<collection>_rels` 행을 다건 참조 값으로
 * 갈아 끼운다. `translation_seen`은 처음 만들 때 `{}`이고 바꿀 때는 그대로 둔다.
 */
export async function saveCopy(
	ctx: WriteContext,
	name: string,
	collection: CollectionSchema,
	key: CopyKey,
	values: CopyValues,
): Promise<void> {
	const db = tablesOf(ctx.db);
	const { columns, rels } = encodeData(collection, values.data);
	const row = { ...columns, slug: values.slug, published_at: values.published_at ?? null };
	await db
		.insertInto(`${name}_data`)
		.values({ ...key, ...row })
		.onConflict((conflict) => conflict.columns(["entry_id", "locale", "status"]).doUpdateSet(row))
		.execute();
	await db
		.deleteFrom(`${name}_rels`)
		.where("entry_id", "=", key.entry_id)
		.where("locale", "=", key.locale)
		.where("status", "=", key.status)
		.execute();
	// 빈 `values`는 SQL이 아니다: 다건 참조가 없으면 넣을 행도 없다.
	if (rels.length > 0)
		await db
			.insertInto(`${name}_rels`)
			.values(rels.map((rel) => ({ ...key, ...rel })))
			.execute();
}
