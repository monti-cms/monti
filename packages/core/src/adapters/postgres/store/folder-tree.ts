import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { CmsError } from "../../../core/store/errors";
import type { Db } from "../db/kysely";

/** A folder row with the columns the trash reads. */
export interface FolderNode {
	id: string;
	collection: string;
	parent_id: string | null;
	name: string;
	position: number;
	version: number;
	deleted_at: Date | null;
}

const NODE_COLUMNS = ["id", "collection", "parent_id", "name", "position", "version", "deleted_at"] as const;

/** The folder `rootId` and every folder below it, trashed or not, parents before children. */
export async function subtreeOf(db: Db, qSchema: string, rootId: string): Promise<FolderNode[]> {
	const result = await sql<FolderNode>`
		with recursive subtree as (
			select ${sql.join(NODE_COLUMNS.map((column) => sql.ref(`f0.${column}`)))}, 0 as depth
			from ${sql.id(qSchema, "folders")} f0 where f0.id = ${rootId}
			union all
			select ${sql.join(NODE_COLUMNS.map((column) => sql.ref(`f.${column}`)))}, s.depth + 1
			from ${sql.id(qSchema, "folders")} f join subtree s on f.parent_id = s.id
		)
		select ${sql.join(NODE_COLUMNS.map((column) => sql.ref(column)))} from subtree order by depth, id`.execute(db);
	return result.rows;
}

/** A folder by id, or `undefined`. */
export const findFolder = (db: Db, id: string): Promise<FolderNode | undefined> =>
	db.selectFrom("folders").select(NODE_COLUMNS).where("id", "=", id).executeTakeFirst();

/** The live folder named `name` directly under `parentId` in `collection`, or `undefined`. */
export const findLiveSibling = (
	db: Db,
	collection: string,
	parentId: string | null,
	name: string,
): Promise<{ id: string } | undefined> =>
	db
		.selectFrom("folders")
		.select("id")
		.where("collection", "=", collection)
		.where("name", "=", name)
		.where("deleted_at", "is", null)
		.where((eb) => (parentId === null ? eb("parent_id", "is", null) : eb("parent_id", "=", parentId)))
		.executeTakeFirst();

/** Where something goes back to: the live folder, and whether a folder had to be made again on the way. */
export interface LivePath {
	readonly id: string | null;
	readonly recreated: boolean;
}

/**
 * The live folder to put something back in when its own folder is in the trash: the folder itself when it is live, else a live folder of the same name under the
 * live place of its parent (found, or made again, up the whole path). `null` (the top) stays the top. The trashed folder is left where it is.
 */
export async function ensureLivePath(db: Db, folderId: string | null): Promise<LivePath> {
	if (folderId === null) return { id: null, recreated: false };
	const folder = await findFolder(db, folderId);
	if (!folder) throw new CmsError("Folder not found", "not_found");
	if (folder.deleted_at === null) return { id: folder.id, recreated: false };
	const parent = await ensureLivePath(db, folder.parent_id);
	const sibling = await findLiveSibling(db, folder.collection, parent.id, folder.name);
	if (sibling) return { id: sibling.id, recreated: parent.recreated };
	const id = randomUUID();
	await db
		.insertInto("folders")
		.values({
			id,
			collection: folder.collection,
			parent_id: parent.id,
			name: folder.name,
			position: folder.position,
			version: 1,
			deleted_at: null,
		})
		.execute();
	return { id, recreated: true };
}

/**
 * Puts restored entries or media files in a live folder: one whose folder is in the trash goes to the live folder of the same path (`ensureLivePath`), made
 * again where it is missing. `placed` says whether any of them was in a trashed folder, `recreated` whether a folder had to be made.
 */
export async function placeInLiveFolders(
	db: Db,
	table: "entries" | "media_assets",
	ids: readonly string[],
): Promise<{ placed: boolean; recreated: boolean; folderId: string | null }> {
	const outcome = { placed: false, recreated: false, folderId: null as string | null };
	if (ids.length === 0) return outcome;
	const anyIds = sql<string>`any(${[...ids]}::uuid[])`;
	const folders = await db
		.selectFrom(table)
		.select("folder_id")
		.distinct()
		.where("id", "=", anyIds)
		.where("folder_id", "is not", null)
		.execute();
	for (const { folder_id: folderId } of folders) {
		if (folderId === null) continue;
		const folder = await findFolder(db, folderId);
		if (!folder || folder.deleted_at === null) continue;
		const path = await ensureLivePath(db, folderId);
		await db
			.updateTable(table)
			.set({ folder_id: path.id })
			.where("id", "=", anyIds)
			.where("folder_id", "=", folderId)
			.execute();
		outcome.placed = true;
		outcome.recreated ||= path.recreated;
		outcome.folderId = path.id;
	}
	return outcome;
}
