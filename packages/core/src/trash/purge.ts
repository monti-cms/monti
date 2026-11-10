import { type Kysely, sql, type Transaction } from "kysely";
import type { Database } from "../db/schema";
import { UNDO_DAYS } from "../engine/execute";
import type { Storage } from "../media/storage";
import { unlinkTargetGroup } from "../relations/sync";
import type { Schema } from "../schema/define";

type Db = Kysely<Database> | Transaction<Database>;

/** How long the trash keeps something: as long as a write can be undone (doc 11). */
export const TRASH_DAYS = UNDO_DAYS;
const DAY = 86_400_000;

/** A row of the trash: an entry (with the translations that went with it), a folder (with what it holds) or a file. */
export type TrashRef = { kind: "entry" | "folder" | "media"; id: string };

/** How long an upload may wait to become an item, and a replaced file to leave the pages that still name it. */
const LOOSE_DAYS = 1;

/** The folder and every folder under it, in the trash or not. */
export async function foldersUnder(db: Db, id: string): Promise<string[]> {
	const { rows } = await sql<{ id: string }>`
		with recursive tree as (
			select id from folders where id = ${id}
			union all
			select f.id from folders f join tree on f.parent_id = tree.id
		) select id from tree`.execute(db);
	return rows.map((row) => row.id);
}

/** The entries a permanent delete of these takes: every language of each that is in the trash, as the trash shows them, one row. */
async function entriesToPurge(db: Db, ids: string[]): Promise<{ id: string; group: string }[]> {
	if (ids.length === 0) return [];
	const rows = await db
		.selectFrom("entries")
		.select(["id", "translation_group as group"])
		.where("trashed_at", "is not", null)
		.where(
			"translation_group",
			"in",
			db.selectFrom("entries").select("translation_group").where("id", "in", ids).where("trashed_at", "is not", null),
		)
		.execute();
	return rows;
}

/** Hands a file's keys to the clean-up: the bytes leave the storage after the delete commits. */
export async function loosen(db: Db, keys: string[], after: Date): Promise<void> {
	if (keys.length === 0) return;
	await db
		.insertInto("loose_files")
		.values(keys.map((key) => ({ key, remove_after: after })))
		.onConflict((conflict) => conflict.column("key").doUpdateSet({ remove_after: after }))
		.execute();
}

/** A key the byte route just wrote: loose until `media.upload` or `media.replace` makes it a file's. */
export const looseUntil = (now: Date) => new Date(now.getTime() + LOOSE_DAYS * DAY);

/**
 * Deletes rows of the trash for good (doc 11): entries with the paths they were published under kept from other entries and the relations that pointed at them
 * cut (doc 08), files with their bytes handed to the clean-up, folders with everything in them. Whatever a folder still holds outside the trash moves to the top
 * level.
 */
export async function purgeRows(db: Db, schema: Schema, rows: TrashRef[], now: Date): Promise<void> {
	const ids = (kind: TrashRef["kind"]) => rows.filter((row) => row.kind === kind).map((row) => row.id);
	const folders = new Set<string>();
	for (const id of ids("folder")) for (const each of await foldersUnder(db, id)) folders.add(each);
	const entryIds = new Set(ids("entry"));
	const mediaIds = new Set(ids("media"));
	if (folders.size > 0) {
		const inside = [...folders];
		const entries = await db
			.selectFrom("entries")
			.select("id")
			.where("folder_id", "in", inside)
			.where("trashed_at", "is not", null)
			.execute();
		for (const row of entries) entryIds.add(row.id);
		const files = await db
			.selectFrom("media")
			.select("id")
			.where("folder_id", "in", inside)
			.where("trashed_at", "is not", null)
			.execute();
		for (const row of files) mediaIds.add(row.id);
	}

	const entries = await entriesToPurge(db, [...entryIds]);
	if (entries.length > 0) {
		const gone = entries.map((entry) => entry.id);
		// Every path the entry was ever published under: `trash.move` wrote down the last one (doc 11, principle 5).
		const paths = await db
			.selectFrom("old_paths")
			.select(["collection", "locale", "slug"])
			.where("entry_id", "in", gone)
			.execute();
		if (paths.length > 0)
			await db
				.insertInto("reserved_paths")
				.values(paths.map((path) => ({ ...path, since: now })))
				.onConflict((conflict) => conflict.doNothing())
				.execute();
		await db.deleteFrom("entries").where("id", "in", gone).execute();
		const groups = [...new Set(entries.map((entry) => entry.group))];
		const left = await db
			.selectFrom("entries")
			.select("translation_group")
			.where("translation_group", "in", groups)
			.execute();
		const staying = new Set(left.map((row) => row.translation_group));
		for (const group of groups.filter((each) => !staying.has(each))) {
			await unlinkTargetGroup(db, schema, group, now);
			await db.deleteFrom("entry_links").where("from_group", "=", group).execute();
		}
	}

	if (mediaIds.size > 0) {
		const files = await db
			.selectFrom("media")
			.select(["id", "original_key", "web_key"])
			.where("id", "in", [...mediaIds])
			.where("trashed_at", "is not", null)
			.execute();
		if (files.length > 0) {
			await db
				.deleteFrom("media")
				.where(
					"id",
					"in",
					files.map((file) => file.id),
				)
				.execute();
			await loosen(
				db,
				files.flatMap((file) => [file.original_key, ...(file.web_key ? [file.web_key] : [])]),
				now,
			);
		}
	}

	if (folders.size > 0) {
		const inside = [...folders];
		await db
			.updateTable("entries")
			.set((eb) => ({ folder_id: null, version: eb("version", "+", 1) }))
			.where("folder_id", "in", inside)
			.execute();
		await db
			.updateTable("media")
			.set((eb) => ({ folder_id: null, version: eb("version", "+", 1) }))
			.where("folder_id", "in", inside)
			.execute();
		await db.deleteFrom("folders").where("id", "in", inside).execute();
	}
}

/** Every row in the trash, for emptying it; with `before`, the rows thrown away by then. Entries and files inside a folder go with the folder. */
export async function everyTrashRow(db: Db, before?: Date): Promise<TrashRef[]> {
	let folders = db.selectFrom("folders").select("id").where("trashed_at", "is not", null);
	let entries = db.selectFrom("entries").select("id").where("trashed_at", "is not", null);
	let files = db.selectFrom("media").select("id").where("trashed_at", "is not", null);
	if (before) {
		folders = folders.where("trashed_at", "<=", before);
		entries = entries.where("trashed_at", "<=", before);
		files = files.where("trashed_at", "<=", before);
	}
	return [
		...(await folders.execute()).map((row) => ({ kind: "folder" as const, id: row.id })),
		...(await entries.execute()).map((row) => ({ kind: "entry" as const, id: row.id })),
		...(await files.execute()).map((row) => ({ kind: "media" as const, id: row.id })),
	];
}

/**
 * Removes from the storage the files no media row holds and whose time has come: uploads that never became an item, replaced files, deleted ones (doc 11,
 * T103). A key a media row holds after all is only forgotten. A file the storage fails to remove stays listed for the next run.
 */
export async function sweepLooseFiles(db: Kysely<Database>, storage: Storage | null, now: Date): Promise<number> {
	if (!storage) return 0;
	const due = await db.selectFrom("loose_files").select("key").where("remove_after", "<=", now).execute();
	let removed = 0;
	for (const { key } of due) {
		const held = await db
			.selectFrom("media")
			.select("id")
			.where((eb) => eb.or([eb("original_key", "=", key), eb("web_key", "=", key)]))
			.executeTakeFirst();
		if (!held) {
			try {
				await storage.remove(key);
				removed++;
			} catch {
				continue;
			}
		}
		await db.deleteFrom("loose_files").where("key", "=", key).execute();
	}
	return removed;
}

/**
 * The clean-up (`monti trash:purge`, and when the admin opens, doc 11): deletes what has been in the trash for 30 days, forgets the snapshots of writes that can no
 * longer be undone (T7), and removes the loose files from the storage.
 */
export async function purgeDue(
	db: Kysely<Database>,
	schema: Schema,
	storage: Storage | null,
	now: Date,
): Promise<{ purged: number; files: number }> {
	const purged = await db.transaction().execute(async (trx) => {
		const rows = await everyTrashRow(trx, new Date(now.getTime() - TRASH_DAYS * DAY));
		if (rows.length > 0) await purgeRows(trx, schema, rows, now);
		await trx
			.deleteFrom("monti_activity_snapshot")
			.where("activity_id", "in", trx.selectFrom("monti_activity").select("id").where("undo_until", "<", now))
			.execute();
		return rows.length;
	});
	return { purged, files: await sweepLooseFiles(db, storage, now) };
}
