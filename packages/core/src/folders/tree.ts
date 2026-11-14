import { type RawBuilder, sql } from "kysely";

/**
 * The folder and every folder under it, as a query of their ids: the one place a folder's tree is walked. `live`: those not in the trash (what a list
 * reaches); `trashed`: those in it (what a permanent delete takes); `any`: both.
 */
export function folderTreeSql(id: string, which: "live" | "trashed" | "any" = "live"): RawBuilder<{ id: string }> {
	const kept = (column: string) =>
		which === "live"
			? sql`${sql.ref(column)} is null`
			: which === "trashed"
				? sql`${sql.ref(column)} is not null`
				: sql`true`;
	return sql<{ id: string }>`(with recursive tree as (
		select id from folders where id = ${id} and ${kept("folders.trashed_at")}
		union all
		select f.id from folders f join tree on f.parent_id = tree.id where ${kept("f.trashed_at")}
	) select id from tree)`;
}

/**
 * Where a list, or a filter menu's count, reaches in its folders (doc 07): the entries' list and the library's go by it alike. A folder lists what sits
 * right in it; a search or a filter looks for things, so inside a folder it goes through its subfolders, and at the top through every folder. A menu's
 * count is what picking it would find, so it reaches as a search does (`looking`). `scope: "all"` reaches everything. Gives the condition on `column`,
 * or nothing when the list reaches every folder.
 */
export function folderReachSql(
	column: string,
	{ folder, scope, looking }: { folder: string | null | undefined; scope: "here" | "all"; looking: boolean },
): RawBuilder<boolean> | null {
	if (folder === undefined || scope !== "here") return null;
	if (folder !== null)
		return looking
			? sql<boolean>`${sql.ref(column)} in ${folderTreeSql(folder)}`
			: sql<boolean>`${sql.ref(column)} = ${folder}`;
	return looking ? null : sql<boolean>`${sql.ref(column)} is null`;
}
