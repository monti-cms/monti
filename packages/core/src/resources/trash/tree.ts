import { sql } from "kysely";
import type { ReadContext } from "../../engine/types";
import { tablesOf } from "../entries/tables";
import type { TrashTarget } from "./items";

/** 동작이 함께 다루는 항목들: 글은 모두 `scope` 컬렉션의 글이다. */
export interface Tree {
	scope: string;
	entries: string[];
	folders: string[];
	media: string[];
}

/** `= any(ids)`: `ids` 가운데 하나와 같다. `ids`가 비면 아무것도 고르지 않는다. */
export function anyOf(ids: string[]) {
	return sql<string>`any(${ids}::uuid[])`;
}

/** `scope`가 스키마의 컬렉션이면 그 글 테이블 이름. 컬렉션 테이블 이름은 이 검사를 거친 것만 쓴다. */
export function entryTable(ctx: ReadContext, scope: string): string | undefined {
	return Object.hasOwn(ctx.schema.collections, scope) ? scope : undefined;
}

/**
 * 폴더 `rootId`와, 한 단계씩 내려가며 `trashed_at`이 부모와 같은 하위 폴더들: 활성 폴더 아래의 활성 폴더, 또는 휴지통
 * 폴더와 함께 들어간 폴더.
 */
function folderTree(ctx: ReadContext, rootId: string) {
	return tablesOf(ctx.db).withRecursive("tree(id, trashed_at)", (db) =>
		db
			.selectFrom("folders")
			.select(["id", "trashed_at"])
			.where("id", "=", rootId)
			.unionAll((down) =>
				down
					.selectFrom("folders")
					.innerJoin("tree", "tree.id", "folders.parent_id")
					.select(["folders.id", "folders.trashed_at"])
					.whereRef("folders.trashed_at", "is not distinct from", "tree.trashed_at"),
			),
	);
}

function idsOf(rows: { id: unknown }[]): string[] {
	return rows.map((row) => String(row.id));
}

/** 폴더 트리의 폴더에 바로 든 `table`의 행 가운데 그 폴더와 `trashed_at`이 같은 것들. */
async function itemsIn(tree: ReturnType<typeof folderTree>, table: string): Promise<string[]> {
	const rows = await tree
		.selectFrom(`${table} as item`)
		.innerJoin("tree", "tree.id", "item.folder_id")
		.select("item.id")
		.whereRef("item.trashed_at", "is not distinct from", "tree.trashed_at")
		.execute();
	return idsOf(rows);
}

/** 폴더 `target`의 트리와 그 폴더들에 든 같은 `trashed_at`의 글(컬렉션 폴더)과 미디어. */
async function treeOf(ctx: ReadContext, target: TrashTarget): Promise<Tree> {
	const tree = folderTree(ctx, target.id);
	const folders = idsOf(await tree.selectFrom("tree").select("id").execute());
	const table = entryTable(ctx, target.scope);
	const entries = table === undefined ? [] : await itemsIn(tree, table);
	return { scope: target.scope, folders, entries, media: await itemsIn(tree, "media") };
}

/** `target`에 대한 동작이 함께 다루는 것: 폴더면 그 트리, 글이나 미디어면 그것 하나. */
export async function itemsOf(ctx: ReadContext, target: TrashTarget): Promise<Tree> {
	const { kind, id, scope } = target;
	if (kind === "folder") return treeOf(ctx, target);
	return { scope, entries: kind === "entry" ? [id] : [], folders: [], media: kind === "media" ? [id] : [] };
}
