import { MontiError } from "../../engine/errors";
import type { CollectionSchema, ReadContext } from "../../engine/types";
import type { Doc } from "../../rich-text/types";
import { mediaIdsOf } from "../_shared/doc";
import type { IsActive } from "./decode";
import { targetOf, valuesOf } from "./slots";
import { tablesOf } from "./tables";

/** 테이블(`media` 또는 컬렉션)별로 참조하는 `id`들. */
export type References = Map<string, Set<string>>;

/** `ids`를 `refs`의 `table` 칸에 더한다. */
function addReferences(refs: References, table: string, ids: Iterable<string>): References {
	const set = refs.get(table) ?? new Set<string>();
	for (const id of ids) set.add(id.toLowerCase());
	refs.set(table, set);
	return refs;
}

/** `fields`의 미디어·관계 필드가 참조하는 대상들. */
export function referencesIn(
	collection: CollectionSchema,
	fields: Record<string, unknown>,
	refs: References = new Map(),
) {
	for (const { slot, value } of valuesOf(collection, fields)) {
		const table = targetOf(slot.field);
		if (table !== undefined) addReferences(refs, table, [value].flat() as string[]);
	}
	return refs;
}

/** 본문 블록 트리 전체가 참조하는 미디어. 본문이 없으면 더하지 않는다. */
export function bodyReferences(body: Doc | undefined, refs: References = new Map()): References {
	return body === undefined ? refs : addReferences(refs, "media", mediaIdsOf(body.blocks));
}

/** `refs` 가운데 휴지통에 없는 행이 있는 대상들. */
export async function activeIds(ctx: ReadContext, refs: References): Promise<References> {
	const active: References = new Map();
	for (const [table, ids] of refs) {
		// `in ()`는 SQL이 아니다: 참조가 없으면 찾을 것도 없다.
		if (ids.size === 0) continue;
		const rows = await tablesOf(ctx.db)
			.selectFrom(table)
			.select("id")
			.where("id", "in", [...ids])
			.where("trashed_at", "is", null)
			.execute();
		addReferences(
			active,
			table,
			rows.map((row) => String(row.id)),
		);
	}
	return active;
}

/** `active`에 든 대상만 살아 있다고 보는 판정. */
export function isIn(active: References): IsActive {
	return (table, id) => active.get(table)?.has(id) ?? false;
}

/** 살아 있지 않은(없거나 휴지통에 있는) 대상을 참조하면 거절한다. */
export async function rejectInactive(ctx: ReadContext, refs: References): Promise<void> {
	const active = await activeIds(ctx, refs);
	for (const [table, ids] of refs) {
		if ((active.get(table)?.size ?? 0) !== ids.size) {
			throw new MontiError("BAD_REQUEST", `"${table}"에서 활성 상태가 아닌 대상을 참조한다`);
		}
	}
}
