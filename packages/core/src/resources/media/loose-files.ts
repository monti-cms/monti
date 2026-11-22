import type { Kysely } from "kysely";
import type { Database } from "../../db/types";
import type { StorageAdapter } from "../../engine/types";

/**
 * Removes from the storage every file in `loose_files` whose `remove_after` has passed, and its row once removed. A file
 * the storage fails to remove keeps its row for the next run; the rest are removed all the same.
 */
export async function removeLooseFiles({
	db,
	storage,
}: {
	db: Kysely<Database>;
	storage: StorageAdapter;
}): Promise<void> {
	const due = await db.selectFrom("loose_files").select("key").where("remove_after", "<", new Date()).execute();
	for (const { key } of due) {
		const removed = await storage.remove(key).then(
			() => true,
			() => false,
		);
		// A file the storage failed to remove keeps its row: the next run tries it again.
		if (removed) await db.deleteFrom("loose_files").where("key", "=", key).execute();
	}
}
