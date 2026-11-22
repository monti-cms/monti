import type { ReadContext } from "../../engine/types";
import { collectionNames, collectionOf } from "../_shared/collection";
import { copyQuery, entriesOf } from "./read";
import type { Entry, Status } from "./types";

/** `entries.list`의 조건. 주지 않은 조건은 거르지 않는다. */
export interface ListFilter {
	collection?: string;
	locale?: string;
	folder_id?: string | null;
	relation?: { field: string; id: string };
	status?: Status;
}

type CopyQuery = ReturnType<typeof copyQuery>;

/**
 * 최상위 관계 필드 `field`가 `id`를 가리키는 행만 남긴다: 단건은 열 값으로, 다건은 `_rels` 행으로. 그 관계 필드가
 * 없는 컬렉션은 undefined: 맞는 글이 없다.
 */
function whereRelation(ctx: ReadContext, name: string, query: CopyQuery, relation: { field: string; id: string }) {
	const fields = collectionOf(ctx, name).fields;
	const field = Object.hasOwn(fields, relation.field) ? fields[relation.field] : undefined;
	if (field?.type !== "relation") return undefined;
	if (field.many !== true) return query.where(`d.${relation.field}`, "=", relation.id);
	return query.where(({ exists, selectFrom }) =>
		exists(
			selectFrom(`${name}_rels as r`)
				.select("r.position")
				.whereRef("r.entry_id", "=", "d.entry_id")
				.whereRef("r.locale", "=", "d.locale")
				.whereRef("r.status", "=", "d.status")
				.where("r.path", "=", relation.field)
				.where(`r.${field.to}_id`, "=", relation.id),
		),
	);
}

/** 컬렉션 `name`에서 `filter`에 모두 맞는 글들. 언어를 생략하면 글마다 원문 언어 하나다. */
async function listIn(ctx: ReadContext, name: string, filter: ListFilter): Promise<Entry[]> {
	let query: CopyQuery | undefined = copyQuery(ctx, name, filter.status ?? "published");
	query =
		filter.locale === undefined
			? query.whereRef("d.locale", "=", "e.source_locale")
			: query.where("d.locale", "=", filter.locale);
	if (filter.folder_id === null) query = query.where("e.folder_id", "is", null);
	if (typeof filter.folder_id === "string") query = query.where("e.folder_id", "=", filter.folder_id);
	if (filter.relation !== undefined) query = whereRelation(ctx, name, query, filter.relation);
	return query === undefined ? [] : entriesOf(ctx, name, await query.execute());
}

/** `filter`에 모두 맞는 활성 글들의 발행본, `status: "draft"`이면 작업본. */
export async function listEntries(filter: ListFilter, ctx: ReadContext): Promise<Entry[]> {
	const names = collectionNames(ctx, filter.collection);
	const lists = [];
	for (const name of names) lists.push(await listIn(ctx, name, filter));
	return lists.flat();
}
