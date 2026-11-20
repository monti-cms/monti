import { sql } from "kysely";
import type { ReadContext } from "../../engine/types";
import type { TrashRef } from "./items";

/** The ids an action takes along, by table. */
export interface Tree {
	entries: string[];
	folders: string[];
	media: string[];
}

const TABLES = { entry: "entries", folder: "folders", media: "media" } as const;

/** `= any(ids)`: matches one of `ids`, and nothing when there are none. */
export function anyOf(ids: string[]) {
	return sql<string>`any(${ids}::uuid[])`;
}

/**
 * The folder `rootId` and, step by step down, each subfolder whose `trashed_at` is its parent's: the active ones under
 * an active folder, or those that went into the trash with a trashed one.
 */
function folderTree(ctx: ReadContext, rootId: string) {
	return ctx.db.withRecursive("tree(id, trashed_at)", (db) =>
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

function idsOf(rows: { id: string }[]): string[] {
	return rows.map((row) => row.id);
}

/** The folder tree of `rootId` with the entries and media directly in its folders that have their folder's `trashed_at`. */
async function treeOf(ctx: ReadContext, rootId: string): Promise<Tree> {
	const tree = folderTree(ctx, rootId);
	const folders = await tree.selectFrom("tree").select("id").execute();
	const entries = await tree
		.selectFrom("entries")
		.innerJoin("tree", "tree.id", "entries.folder_id")
		.select("entries.id")
		.whereRef("entries.trashed_at", "is not distinct from", "tree.trashed_at")
		.execute();
	const media = await tree
		.selectFrom("media")
		.innerJoin("tree", "tree.id", "media.folder_id")
		.select("media.id")
		.whereRef("media.trashed_at", "is not distinct from", "tree.trashed_at")
		.execute();
	return { folders: idsOf(folders), entries: idsOf(entries), media: idsOf(media) };
}

/** What an action on `item` takes along: a folder's tree, or the entry or media alone. */
export async function itemsOf(ctx: ReadContext, item: TrashRef): Promise<Tree> {
	if (item.kind === "folder") return treeOf(ctx, item.id);
	return { entries: [], folders: [], media: [], [TABLES[item.kind]]: [item.id] };
}
