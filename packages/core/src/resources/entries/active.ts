import { MontiError } from "../../engine/errors";
import type { CollectionSchema, ReadContext } from "../../engine/types";
import type { Doc } from "../../rich-text/types";
import { mediaIdsOf } from "../_shared/doc";
import type { IsActive } from "./decode";
import { targetOf, valuesOf } from "./slots";
import { tablesOf } from "./tables";
import type { EntryData } from "./types";

/**
 * 경로마다 그 경로가 가리키는 테이블(`media` 또는 컬렉션)과 참조하는 `id`들. 경로는 `_rels.path`·`media_uses.field_path`와
 * 같은 단위다: 최상위 필드 `"<field>"`, 조건부 하위 필드 `"<field>.<option>.<subfield>"`, 본문 `"body"`·`"content"`.
 */
export type References = Map<string, { table: string; ids: Set<string> }>;

/** 테이블마다 참조된 대상 가운데 행이 있는 것과 그 행이 휴지통에 있는지. 행이 없는 대상은 담지 않는다. */
type Found = Map<string, Map<string, boolean>>;

/** `ids`를 `refs`의 `path` 칸에 소문자로 더한다. */
function addReferences(refs: References, path: string, table: string, ids: Iterable<string>): References {
	const target = refs.get(path) ?? { table, ids: new Set<string>() };
	for (const id of ids) target.ids.add(id.toLowerCase());
	refs.set(path, target);
	return refs;
}

/** `fields`의 미디어·관계 필드가 참조하는 대상들, 필드 경로별로. `only`를 주면 그 테이블을 가리키는 필드만 본다. */
export function referencesIn(
	collection: CollectionSchema,
	fields: Record<string, unknown>,
	refs: References = new Map(),
	only?: string,
) {
	for (const { slot, value } of valuesOf(collection, fields)) {
		const table = targetOf(slot.field);
		if (table !== undefined && (only === undefined || table === only)) {
			addReferences(refs, slot.path, table, [value].flat() as string[]);
		}
	}
	return refs;
}

/** 본문 블록 트리 전체가 참조하는 미디어를 `path` 경로에 더한다. 본문이 없으면 더하지 않는다. */
export function bodyReferences(path: string, body: Doc | undefined, refs: References = new Map()): References {
	return body === undefined ? refs : addReferences(refs, path, "media", mediaIdsOf(body.blocks));
}

/** 글 한 언어·상태의 필드와 본문(`"body"` 경로)이 참조하는 대상들. */
export function referencesOf(collection: CollectionSchema, data: EntryData): References {
	return bodyReferences("body", data.body, referencesIn(collection, data.fields));
}

/** `refs`가 가리키는 대상 가운데 행이 있는 것들과 그 행이 휴지통에 있는지, 테이블별로. */
export async function foundOf(ctx: ReadContext, refs: References): Promise<Found> {
	const wanted = new Map<string, Set<string>>();
	for (const { table, ids } of refs.values()) wanted.set(table, new Set([...(wanted.get(table) ?? []), ...ids]));
	const found: Found = new Map();
	for (const [table, ids] of wanted) {
		// `in ()`는 SQL이 아니다: 참조가 없으면 찾을 것도 없다.
		if (ids.size === 0) continue;
		const rows = await tablesOf(ctx.db)
			.selectFrom(table)
			.select(["id", "trashed_at"])
			.where("id", "in", [...ids])
			.execute();
		found.set(table, new Map(rows.map((row) => [String(row.id), row.trashed_at !== null])));
	}
	return found;
}

/** 행이 있고 휴지통에 없는 대상만 살아 있다고 보는 판정. */
export function isIn(found: Found): IsActive {
	return (table, id) => found.get(table)?.get(id) === false;
}

/**
 * 없는 대상(다른 컬렉션의 글 포함)을 참조하면 거절하고, 휴지통에 있는 대상은 `kept`의 같은 경로에 이미 있던 `id`일 때만
 * 받는다. `kept`는 고치는 작업본이나 템플릿에 이미 저장되어 있던 참조다.
 */
export async function rejectInactive(ctx: ReadContext, refs: References, kept: References = new Map()): Promise<void> {
	const found = await foundOf(ctx, refs);
	for (const [path, { table, ids }] of refs) {
		for (const id of ids) {
			const trashed = found.get(table)?.get(id);
			if (trashed === undefined) throw new MontiError("BAD_REQUEST", `"${path}" 경로가 없는 대상을 참조한다`);
			if (trashed && kept.get(path)?.ids.has(id) !== true) {
				throw new MontiError("BAD_REQUEST", `"${path}" 경로가 휴지통에 있는 대상을 참조한다`);
			}
		}
	}
}
