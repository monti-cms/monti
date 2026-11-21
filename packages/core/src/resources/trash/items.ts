import { sql } from "kysely";
import { MontiError } from "../../engine/errors";
import type { ReadContext } from "../../engine/types";
import { tablesOf } from "../entries/tables";

/** 휴지통 동작이 돌려주는 휴지통의 글·폴더·미디어. */
export interface TrashItem {
	kind: "entry" | "folder" | "media";
	id: string;
	name: string | null;
	trashed_at: Date;
}

export type TrashRef = Pick<TrashItem, "kind" | "id">;

/** 동작이 다루는 항목과 그 `scope`: 글은 컬렉션, 폴더는 자기 `scope`, 미디어는 `"media"`. */
export interface TrashTarget extends TrashRef {
	scope: string;
}

/** 항목 한 행과, 상위 폴더와 같은 `trashed_at`으로 함께 휴지통에 들어갔는지. */
interface ItemRow extends TrashTarget {
	name: string | null;
	trashed_at: Date | null;
	together: boolean;
}

const SHOWN = ["item.kind", "item.id", "item.name", "item.trashed_at"] as const;

const TARGET = ["item.kind", "item.id", "item.scope"] as const;

function kindOf(kind: TrashItem["kind"]) {
	return sql<TrashItem["kind"]>`${sql.lit(kind)}`.as("kind");
}

function scopeOf(scope: string) {
	return sql<string>`${scope}::text`.as("scope");
}

/** `parent`로 붙인 상위 폴더의 `trashed_at`이 `table` 행의 `trashed_at`과 같은지. */
function together(table: string) {
	return sql<boolean>`${sql.ref("parent.trashed_at")} is not distinct from ${sql.ref(`${table}.trashed_at`)}`.as(
		"together",
	);
}

/** 컬렉션 `name`의 글들: 원문 언어 작업본의 `slug`가 이름이다. */
function entryRows(ctx: ReadContext, name: string) {
	return tablesOf(ctx.db)
		.selectFrom(`${name} as e`)
		.innerJoin(`${name}_data as d`, (join) =>
			join.onRef("d.entry_id", "=", "e.id").onRef("d.locale", "=", "e.source_locale").on("d.status", "=", "draft"),
		)
		.leftJoin("folders as parent", "parent.id", "e.folder_id")
		.select([kindOf("entry"), "e.id", scopeOf(name), "d.slug as name", "e.trashed_at", together("e")])
		.$castTo<ItemRow>();
}

function folderRows(ctx: ReadContext) {
	return ctx.db
		.selectFrom("folders")
		.leftJoin("folders as parent", "parent.id", "folders.parent_id")
		.select([kindOf("folder"), "folders.id", "folders.scope", "folders.name", "folders.trashed_at"])
		.select(together("folders"))
		.$castTo<ItemRow>();
}

/** 미디어들: `key`가 이름이다. */
function mediaRows(ctx: ReadContext) {
	return ctx.db
		.selectFrom("media")
		.leftJoin("folders as parent", "parent.id", "media.folder_id")
		.select([kindOf("media"), "media.id", scopeOf("media"), "media.key as name", "media.trashed_at"])
		.select(together("media"))
		.$castTo<ItemRow>();
}

/** 활성이든 휴지통이든 모든 글·폴더·미디어를 `item` 테이블로. 글은 스키마의 컬렉션마다 모은다. */
function allItems(ctx: ReadContext) {
	let rows = folderRows(ctx).unionAll(mediaRows(ctx));
	for (const name of Object.keys(ctx.schema.collections)) rows = rows.unionAll(entryRows(ctx, name));
	return ctx.db.selectFrom(rows.as("item"));
}

/** 휴지통 항목: `trashed_at`이 있는 것. */
function trashed(ctx: ReadContext) {
	return allItems(ctx).where("item.trashed_at", "is not", null);
}

/** 자기 줄이 있는 휴지통 항목: 상위 폴더와 함께 들어간 것을 뺀 나머지. */
export function listedTargets(ctx: ReadContext) {
	return trashed(ctx).where("item.together", "=", false).select(TARGET);
}

/** 휴지통 항목 `id`. 휴지통 항목이 아니면(없거나 활성이면) 거절한다. */
export async function findItem(ctx: ReadContext, id: string): Promise<TrashItem> {
	const item = await trashed(ctx).select(SHOWN).where("item.id", "=", id).$castTo<TrashItem>().executeTakeFirst();
	if (item === undefined) throw new MontiError("NOT_FOUND", "이 id의 휴지통 항목이 없다");
	return item;
}

/** 휴지통 항목 `id`와 그 `scope`. 휴지통 항목이 아니면 거절한다. */
export async function findTarget(ctx: ReadContext, id: string): Promise<TrashTarget> {
	const target = await trashed(ctx).select(TARGET).where("item.id", "=", id).executeTakeFirst();
	if (target === undefined) throw new MontiError("NOT_FOUND", "이 id의 휴지통 항목이 없다");
	return target;
}

/** 활성 항목 `id`와 그 `scope`. 활성 항목이 아니면(없거나 휴지통에 있으면) 거절한다. */
export async function findActive(ctx: ReadContext, id: string): Promise<TrashTarget> {
	const target = await allItems(ctx)
		.select(TARGET)
		.where("item.id", "=", id)
		.where("item.trashed_at", "is", null)
		.executeTakeFirst();
	if (target === undefined) throw new MontiError("NOT_FOUND", "이 id의 활성 글·폴더·미디어가 없다");
	return target;
}

/** 자기 줄이 있는 휴지통 항목들: 최근에 버린 것부터. */
export async function listItems(ctx: ReadContext): Promise<TrashItem[]> {
	return trashed(ctx)
		.where("item.together", "=", false)
		.select(SHOWN)
		.orderBy("item.trashed_at", "desc")
		.$castTo<TrashItem>()
		.execute();
}
