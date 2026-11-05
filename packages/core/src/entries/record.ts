import { type Kysely, sql, type Transaction } from "kysely";
import type { Database, EntryStatus } from "../db/schema";
import { defineRecordKind } from "../records";

type Db = Kysely<Database> | Transaction<Database>;

/** An entry's working copy as operations and the screen read it. */
export type Entry = {
	id: string;
	collection: string;
	locale: string;
	translationGroup: string;
	title: string;
	slug: string;
	values: Record<string, unknown>;
	doc: unknown | null;
	status: EntryStatus;
	hasUnpublishedChanges: boolean;
	version: number;
	folderId: string | null;
	createdAt: Date;
	updatedAt: Date;
	trashedAt: Date | null;
};

export async function loadEntries(db: Db, ids: string[]): Promise<Entry[]> {
	if (ids.length === 0) return [];
	const rows = await db.selectFrom("entries").selectAll().where("id", "in", ids).execute();
	return rows.map((row) => ({
		id: row.id,
		collection: row.collection,
		locale: row.locale,
		translationGroup: row.translation_group,
		title: row.title,
		slug: row.slug,
		values: row.values,
		doc: row.doc,
		status: row.status,
		hasUnpublishedChanges: row.has_unpublished_changes,
		version: row.version,
		folderId: row.folder_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		trashedAt: row.trashed_at,
	}));
}

/** Sets "changed": the entry is published and its working copy is not what the site shows. */
export async function markChanges(db: Db, id: string): Promise<void> {
	await sql`update entries set has_unpublished_changes = exists (
		select 1 from entry_published p where p.entry_id = entries.id
			and (p.title, p.slug, p.values, p.doc) is distinct from (entries.title, entries.slug, entries.values, entries.doc)
	) where id = ${id}`.execute(db);
}

type Snapshot = {
	row: Record<string, unknown> & { version: number; body_text?: unknown };
	published: Record<string, unknown> | null;
	oldPaths: Record<string, unknown>[];
};

const jsonColumns = (row: Record<string, unknown>) =>
	Object.fromEntries(
		Object.entries(row).map(([key, value]) =>
			key === "values" || key === "doc" ? [key, value === null ? null : JSON.stringify(value)] : [key, value],
		),
	);

/**
 * An entry for the engine: its working copy, what the site shows and its old paths, so undoing a publish puts the former published copy back (doc
 * 02).
 */
export const entryRecord = defineRecordKind({
	kind: "entry",
	async load(db, ids) {
		if (ids.length === 0) return [];
		const rows = await db.selectFrom("entries").selectAll().where("id", "in", ids).execute();
		const published = await db.selectFrom("entry_published").selectAll().where("entry_id", "in", ids).execute();
		const oldPaths = await db.selectFrom("old_paths").selectAll().where("entry_id", "in", ids).execute();
		return rows.map((row) => ({
			id: row.id,
			version: row.version,
			data: {
				row,
				published: published.find((copy) => copy.entry_id === row.id) ?? null,
				oldPaths: oldPaths.filter((old) => old.entry_id === row.id),
			} satisfies Snapshot,
		}));
	},
	async restore(db, id, data) {
		if (data === null) {
			await db.deleteFrom("entries").where("id", "=", id).execute();
			return;
		}
		const { row, published, oldPaths } = data as Snapshot;
		// The database makes the body's text itself; it takes no value for it.
		const { body_text: _made, ...kept } = row;
		const values = jsonColumns(kept) as never;
		await db
			.insertInto("entries")
			.values({ ...(values as object), version: row.version + 1 } as never)
			.onConflict((conflict) =>
				conflict
					.column("id")
					.doUpdateSet((eb) => ({ ...(values as object), version: eb("entries.version", "+", 1) }) as never),
			)
			.execute();
		await db.deleteFrom("entry_published").where("entry_id", "=", id).execute();
		if (published)
			await db
				.insertInto("entry_published")
				.values(jsonColumns(published) as never)
				.execute();
		await db.deleteFrom("old_paths").where("entry_id", "=", id).execute();
		for (const old of oldPaths)
			await db
				.insertInto("old_paths")
				.values(old as never)
				.onConflict((conflict) => conflict.doNothing())
				.execute();
	},
});
