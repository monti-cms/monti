import { type Insertable, type Kysely, type Selectable, sql, type Transaction } from "kysely";
import { z } from "zod";
import type {
	Database,
	EntryLinkTable,
	EntryPublishedTable,
	EntryStatus,
	EntryTable,
	OldPathTable,
} from "../db/schema";
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
	position: number;
	folderId: string | null;
	createdAt: Date;
	updatedAt: Date;
	trashedAt: Date | null;
	/** In a translation: source block ids it left out (doc 04). */
	translationSkips: string[];
};

export async function loadEntries(db: Db, ids: string[]): Promise<Entry[]> {
	if (ids.length === 0) return [];
	const rows = await db.selectFrom("entries").selectAll().where("id", "in", ids).execute();
	const byId = new Map(rows.map((row) => [row.id, row]));
	return ids.flatMap((id) => {
		const row = byId.get(id);
		if (!row) return [];
		return [
			{
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
				position: row.position,
				folderId: row.folder_id,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
				trashedAt: row.trashed_at,
				translationSkips: row.translation_skips,
			},
		];
	});
}

/** Sets "changed": the entry is published and its working copy is not what the site shows. */
export async function markChanges(db: Db, id: string): Promise<void> {
	await sql`update entries set has_unpublished_changes = exists (
		select 1 from entry_published p where p.entry_id = entries.id
			and (p.title, p.slug, p.values, p.doc) is distinct from (entries.title, entries.slug, entries.values, entries.doc)
	) where id = ${id}`.execute(db);
}

type Snapshot = {
	row: Selectable<EntryTable>;
	published: Selectable<EntryPublishedTable> | null;
	oldPaths: Selectable<OldPathTable>[];
	links?: Selectable<EntryLinkTable>[];
};

const DateShape = z.union([z.date(), z.iso.datetime().transform((value) => new Date(value))]);
const EntryRowShape: z.ZodType<Selectable<EntryTable>> = z.object({
	id: z.string(),
	collection: z.string(),
	translation_group: z.string(),
	locale: z.string(),
	slug: z.string(),
	title: z.string(),
	status: z.enum(["draft", "published", "archived"]),
	has_unpublished_changes: z.boolean(),
	version: z.number().int(),
	position: z.number(),
	folder_id: z.string().nullable(),
	values: z.record(z.string(), z.unknown()),
	doc: z.unknown().nullable(),
	created_at: DateShape,
	updated_at: DateShape,
	trashed_at: DateShape.nullable(),
	translation_skips: z.array(z.string()),
	body_text: z.string().nullable(),
});
const PublishedRowShape: z.ZodType<Selectable<EntryPublishedTable>> = z.object({
	entry_id: z.string(),
	collection: z.string(),
	locale: z.string(),
	title: z.string(),
	slug: z.string(),
	values: z.record(z.string(), z.unknown()),
	doc: z.unknown().nullable(),
	published_at: DateShape,
	from_version: z.number().int(),
	block_hashes: z.record(z.string(), z.string()),
});
const OldPathRowShape: z.ZodType<Selectable<OldPathTable>> = z.object({
	collection: z.string(),
	locale: z.string(),
	slug: z.string(),
	entry_id: z.string(),
	created_at: DateShape,
});
const LinkRowShape: z.ZodType<Selectable<EntryLinkTable>> = z.object({
	from_group: z.string(),
	field: z.string(),
	to_group: z.string(),
	position: z.number(),
});
const SnapshotShape: z.ZodType<Snapshot> = z.object({
	row: EntryRowShape,
	published: PublishedRowShape.nullable(),
	oldPaths: z.array(OldPathRowShape),
	links: z.array(LinkRowShape).optional(),
});

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
		const groups = [...new Set(rows.map((row) => row.translation_group))];
		const links =
			groups.length > 0
				? await db.selectFrom("entry_links").selectAll().where("from_group", "in", groups).execute()
				: [];
		return rows.map((row) => ({
			id: row.id,
			version: row.version,
			data: {
				row,
				published: published.find((copy) => copy.entry_id === row.id) ?? null,
				oldPaths: oldPaths.filter((old) => old.entry_id === row.id),
				links: links.filter((link) => link.from_group === row.translation_group),
			} satisfies Snapshot,
		}));
	},
	async restore(db, id, data) {
		if (data === null) {
			const entry = await db
				.selectFrom("entries")
				.select(["translation_group"])
				.where("id", "=", id)
				.executeTakeFirst();
			if (entry) {
				const others = await db
					.selectFrom("entries")
					.select("id")
					.where("translation_group", "=", entry.translation_group)
					.where("id", "!=", id)
					.execute();
				if (others.length === 0) {
					await db.deleteFrom("entry_links").where("from_group", "=", entry.translation_group).execute();
				}
			}
			await db.deleteFrom("entries").where("id", "=", id).execute();
			return;
		}
		const { row, published, oldPaths, links } = SnapshotShape.parse(data);
		const values: Insertable<EntryTable> = {
			id: row.id,
			collection: row.collection,
			translation_group: row.translation_group,
			locale: row.locale,
			slug: row.slug,
			title: row.title,
			status: row.status,
			has_unpublished_changes: row.has_unpublished_changes,
			version: row.version + 1,
			position: row.position,
			folder_id: row.folder_id,
			values: JSON.stringify(row.values),
			doc: row.doc === null ? null : JSON.stringify(row.doc),
			created_at: row.created_at,
			updated_at: row.updated_at,
			trashed_at: row.trashed_at,
			translation_skips: JSON.stringify(row.translation_skips),
		};
		const { id: _id, version: _version, ...updated } = values;
		await db
			.insertInto("entries")
			.values(values)
			.onConflict((conflict) =>
				conflict.column("id").doUpdateSet((eb) => ({ ...updated, version: eb("entries.version", "+", 1) })),
			)
			.execute();
		await db.deleteFrom("entry_published").where("entry_id", "=", id).execute();
		if (published) {
			const publishedValues: Insertable<EntryPublishedTable> = {
				entry_id: published.entry_id,
				collection: published.collection,
				locale: published.locale,
				title: published.title,
				slug: published.slug,
				values: JSON.stringify(published.values),
				doc: published.doc === null ? null : JSON.stringify(published.doc),
				published_at: published.published_at,
				from_version: published.from_version,
				block_hashes: JSON.stringify(published.block_hashes),
			};
			await db.insertInto("entry_published").values(publishedValues).execute();
		}
		await db.deleteFrom("old_paths").where("entry_id", "=", id).execute();
		for (const old of oldPaths) {
			const oldPathValues: Insertable<OldPathTable> = {
				collection: old.collection,
				locale: old.locale,
				slug: old.slug,
				entry_id: old.entry_id,
				created_at: old.created_at,
			};
			await db
				.insertInto("old_paths")
				.values(oldPathValues)
				.onConflict((conflict) => conflict.doNothing())
				.execute();
		}
		if (links !== undefined) {
			await db.deleteFrom("entry_links").where("from_group", "=", row.translation_group).execute();
			for (const link of links) {
				await db
					.insertInto("entry_links")
					.values({
						from_group: link.from_group,
						field: link.field,
						to_group: link.to_group,
						position: link.position,
					})
					.onConflict((conflict) => conflict.doNothing())
					.execute();
			}
		}
	},
});
