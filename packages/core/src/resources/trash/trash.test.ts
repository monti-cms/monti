import { randomUUID } from "node:crypto";
import { type Kysely, sql } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../__test__/database";
import { createMemoryStorage, type MemoryStorage } from "../../__test__/memory-storage";
import { migrate } from "../../db/migrate";
import { initial } from "../../db/migrations/0001-initial";
import type { Database } from "../../db/types";
import { createMonti } from "../../engine/engine";
import type { Schema } from "../../engine/types";
import { entries } from "../entries/entries";
import { folders } from "../folders/folders";
import { media } from "../media/media";
import { trash } from "./trash";

let testDb: TestDatabase;
let db: Kysely<Database>;
let storage: MemoryStorage;

const POSTS = "posts";
const TAGS = "tags";

/** `posts` has a body and a relation to `tags`; `tags` has a title only. */
const SCHEMA: Schema = {
	locales: ["ko", "en"],
	collections: {
		[POSTS]: { body: true, fields: { title: { type: "text" }, tag: { type: "relation", to: TAGS } } },
		[TAGS]: { fields: { title: { type: "text" } } },
	},
};

type TrashTable = "entries" | "folders" | "media";

function montiOf(withStorage = true) {
	return createMonti(db, { entries, folders, media, trash }, [], {
		schema: SCHEMA,
		config: { name: "Monti Blog", dev: false, storage: withStorage ? storage : undefined },
		schemaFile: "unused-schema-file",
		configFile: "unused-config-file",
	});
}

beforeEach(async () => {
	testDb = await createTestDatabase();
	await migrate(testDb.db, "core", [initial]);
	db = testDb.db as Kysely<Database>;
	storage = createMemoryStorage();
});

afterEach(async () => {
	await testDb.drop();
});

interface EntrySeed {
	collection?: string;
	slug?: string;
	folder_id?: string;
	fields?: Record<string, unknown>;
	mediaId?: string;
}

/** Creates an active entry with its `ko` source working copy through `entries.create`; `mediaId` puts an image in its body. */
async function createEntry(seed: EntrySeed = {}) {
	const body =
		seed.mediaId === undefined
			? {}
			: { body: { blocks: [{ id: "i1", type: "image", attrs: { mediaId: seed.mediaId } }] } };
	return montiOf().entries.create({
		collection: seed.collection ?? POSTS,
		locale: "ko",
		slug: seed.slug ?? `entry-${randomUUID()}`,
		folder_id: seed.folder_id,
		data: { fields: seed.fields ?? { title: "제목" }, ...body },
	});
}

/** An entry with `ko` and `en` working copies, both published. */
async function createPublishedEntry(seed: EntrySeed = {}) {
	const entry = await createEntry(seed);
	await montiOf().entries.addLocale({ id: entry.id, locale: "en", slug: `entry-${randomUUID()}` });
	await montiOf().entries.publish({ id: entry.id });
	await montiOf().entries.publish({ id: entry.id, locale: "en" });
	return entry;
}

async function createFolder(scope: string, parent_id: string | null = null, name = "Folder") {
	return montiOf().folders.create({ scope, parent_id, name });
}

/** Uploads a file to the memory storage and registers it through `media.create`. */
async function createMedia(folder_id: string | null = null) {
	const key = randomUUID();
	storage.seed(key, { mime: "image/png", size: 1024 });
	return montiOf().media.create({ key, folder_id });
}

async function moveToTrash(id: string) {
	await montiOf().trash.move({ id });
}

/** Moves an item to the trash and makes its `trashed_at` an hour earlier, as if it had been trashed before. */
async function trashEarlier(table: TrashTable, id: string, hours = 1) {
	await moveToTrash(id);
	await sql`update ${sql.table(table)} set trashed_at = trashed_at - make_interval(hours => ${hours}) where id = ${id}`.execute(
		db,
	);
}

/** An item's `trashed_at` as Postgres prints it, microseconds included. */
async function trashedAtText(table: TrashTable, id: string): Promise<string | null> {
	const { rows } = await sql<{ at: string | null }>`
		select trashed_at::text as at from ${sql.table(table)} where id = ${id}
	`.execute(db);
	return rows[0].at;
}

async function entryRow(id: string) {
	return db.selectFrom("entries").selectAll().where("id", "=", id).executeTakeFirst();
}

async function localeRows(id: string) {
	return db.selectFrom("entry_locales").selectAll().where("entry_id", "=", id).orderBy("locale").execute();
}

async function publishedRows(id: string) {
	return db.selectFrom("entry_published").selectAll().where("entry_id", "=", id).orderBy("locale").execute();
}

async function folderRow(id: string) {
	return db.selectFrom("folders").selectAll().where("id", "=", id).executeTakeFirst();
}

async function mediaRow(id: string) {
	return db.selectFrom("media").selectAll().where("id", "=", id).executeTakeFirst();
}

async function usesOfMedia(id: string) {
	return db.selectFrom("media_uses").selectAll().where("media_id", "=", id).execute();
}

async function usesOfEntry(id: string) {
	return db.selectFrom("media_uses").selectAll().where("source_id", "=", id).execute();
}

async function looseFile(key: string) {
	return db.selectFrom("loose_files").selectAll().where("key", "=", key).executeTakeFirst();
}

function byId(a: { id: string }, b: { id: string }): number {
	return a.id < b.id ? -1 : 1;
}

it("TRH-MOVE-1 moves an entry with every locale's working and published copies to the trash, leaving them unchanged", async () => {
	const entry = await createPublishedEntry();
	const before = { locales: await localeRows(entry.id), published: await publishedRows(entry.id) };

	const output = await montiOf().trash.move({ id: entry.id });

	// TRH-MOVE-1.1
	expect((await entryRow(entry.id))?.trashed_at).toBeInstanceOf(Date);
	// TRH-MOVE-1.2
	expect({ locales: await localeRows(entry.id), published: await publishedRows(entry.id) }).toEqual(before);
	// TRH-MOVE-1.3
	expect(output).toEqual({ kind: "entry", id: entry.id });
});

it("TRH-MOVE-2 keeps the relation values of other entries pointing to the trashed entry", async () => {
	const tag = await createEntry({ collection: TAGS });
	const post = await createEntry({ fields: { title: "제목", tag: tag.id } });
	const before = await localeRows(post.id);

	await montiOf(false).trash.move({ id: tag.id });

	// TRH-MOVE-2.1
	expect(await localeRows(post.id)).toEqual(before);
});

it("TRH-MOVE-3 keeps the media_uses rows of a media moved to the trash", async () => {
	const item = await createMedia();
	await createEntry({ mediaId: item.id });
	const before = await db.selectFrom("media_uses").selectAll().execute();

	await montiOf().trash.move({ id: item.id });

	// TRH-MOVE-3.1
	expect((await mediaRow(item.id))?.trashed_at).toBeInstanceOf(Date);
	// TRH-MOVE-3.2
	expect(await db.selectFrom("media_uses").selectAll().execute()).toEqual(before);
});

it("TRH-MOVE-4 moves a folder with its subfolder and their entries to the trash at one time", async () => {
	const parent = await createFolder(POSTS);
	const child = await createFolder(POSTS, parent.id);
	const inParent = await createEntry({ folder_id: parent.id });
	const inChild = await createEntry({ folder_id: child.id });

	const output = await montiOf(false).trash.move({ id: parent.id });
	const times = [
		await trashedAtText("folders", parent.id),
		await trashedAtText("folders", child.id),
		await trashedAtText("entries", inParent.id),
		await trashedAtText("entries", inChild.id),
	];

	// TRH-MOVE-4.1
	expect({ distinct: new Set(times).size, unset: times.filter((at) => at === null).length }).toEqual({
		distinct: 1,
		unset: 0,
	});
	// TRH-MOVE-4.2
	expect(output).toEqual({ kind: "folder", id: parent.id });
});

it("TRH-MOVE-5 moves a media folder with its subfolder and their media to the trash at one time", async () => {
	const parent = await createFolder("media");
	const child = await createFolder("media", parent.id);
	const inParent = await createMedia(parent.id);
	const inChild = await createMedia(child.id);

	await montiOf().trash.move({ id: parent.id });
	const times = [
		await trashedAtText("folders", parent.id),
		await trashedAtText("folders", child.id),
		await trashedAtText("media", inParent.id),
		await trashedAtText("media", inChild.id),
	];

	// TRH-MOVE-5.1
	expect({ distinct: new Set(times).size, unset: times.filter((at) => at === null).length }).toEqual({
		distinct: 1,
		unset: 0,
	});
});

it("TRH-MOVE-6 rejects moving an item already in the trash with NOT_FOUND", async () => {
	const entry = await createEntry();
	await moveToTrash(entry.id);
	const before = await trashedAtText("entries", entry.id);

	// TRH-MOVE-6.1
	await expect(montiOf().trash.move({ id: entry.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
	// TRH-MOVE-6.2
	expect(await trashedAtText("entries", entry.id)).toBe(before);
});

it("TRH-READ-1 lists only the trashed entries, folders and media, the most recently trashed first", async () => {
	const entry = await createEntry();
	const folder = await createFolder(POSTS, null, "Trashed");
	const item = await createMedia();
	await createEntry();
	await trashEarlier("entries", entry.id, 3);
	await trashEarlier("folders", folder.id, 2);
	await trashEarlier("media", item.id, 1);

	const list = await montiOf().trash.list();

	// TRH-READ-1.1
	expect(list.map(({ id }) => id).sort()).toEqual([entry.id, folder.id, item.id].sort());
	// TRH-READ-1.2
	expect(list.map(({ id }) => id)).toEqual([item.id, folder.id, entry.id]);
	// TRH-READ-1.3
	expect([...list].sort(byId)).toEqual(
		[
			{ kind: "entry", id: entry.id, name: entry.slug, trashed_at: (await entryRow(entry.id))?.trashed_at },
			{ kind: "folder", id: folder.id, name: "Trashed", trashed_at: (await folderRow(folder.id))?.trashed_at },
			{ kind: "media", id: item.id, name: item.key, trashed_at: (await mediaRow(item.id))?.trashed_at },
		].sort(byId),
	);
});

it("TRH-READ-2 lists a folder as one row without what went in with it, and an item trashed earlier as its own row", async () => {
	const folder = await createFolder(POSTS);
	await createFolder(POSTS, folder.id);
	const earlier = await createEntry({ folder_id: folder.id });
	await createEntry({ folder_id: folder.id });
	await trashEarlier("entries", earlier.id);
	await moveToTrash(folder.id);

	const list = await montiOf().trash.list();

	// TRH-READ-2.1
	expect(list.map(({ kind, id }) => ({ kind, id }))).toEqual([
		{ kind: "folder", id: folder.id },
		{ kind: "entry", id: earlier.id },
	]);
});

it("TRH-READ-3 gets one trashed item by id", async () => {
	const entry = await createEntry();
	await moveToTrash(entry.id);

	const output = await montiOf().trash.get({ id: entry.id });

	// TRH-READ-3.1
	expect(output).toEqual({
		kind: "entry",
		id: entry.id,
		name: entry.slug,
		trashed_at: (await entryRow(entry.id))?.trashed_at,
	});
});

it("TRH-READ-4 rejects getting an id that is not in the trash with NOT_FOUND", async () => {
	const entry = await createEntry();

	// TRH-READ-4.1
	await expect(montiOf().trash.get({ id: entry.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("TRH-RST-1 restores an entry from the trash as a draft", async () => {
	const entry = await createPublishedEntry();
	await moveToTrash(entry.id);
	const before = await localeRows(entry.id);

	const output = await montiOf(false).trash.restore({ id: entry.id });

	// TRH-RST-1.1
	expect((await entryRow(entry.id))?.trashed_at).toBeNull();
	// TRH-RST-1.2
	expect(await publishedRows(entry.id)).toEqual([]);
	// TRH-RST-1.3
	expect(await localeRows(entry.id)).toEqual(before);
	// TRH-RST-1.4
	expect(output).toEqual({ kind: "entry", id: entry.id });
});

it("TRH-RST-2 restores a folder with what went in with it and leaves an item trashed earlier in the trash", async () => {
	const folder = await createFolder(POSTS);
	const child = await createFolder(POSTS, folder.id);
	const published = await createPublishedEntry({ folder_id: folder.id });
	const earlier = await createEntry({ folder_id: folder.id });
	await trashEarlier("entries", earlier.id);
	const earlierAt = await trashedAtText("entries", earlier.id);
	await moveToTrash(folder.id);

	const output = await montiOf(false).trash.restore({ id: folder.id });

	// TRH-RST-2.1
	expect([
		(await folderRow(folder.id))?.trashed_at,
		(await folderRow(child.id))?.trashed_at,
		(await entryRow(published.id))?.trashed_at,
	]).toEqual([null, null, null]);
	// TRH-RST-2.2
	expect(await publishedRows(published.id)).toEqual([]);
	// TRH-RST-2.3
	expect(await trashedAtText("entries", earlier.id)).toBe(earlierAt);
	// TRH-RST-2.4
	expect(output).toEqual({ kind: "folder", id: folder.id });
});

it("TRH-RST-3 restores an entry whose folders are in the trash into new folders of the same names and leaves the trashed folders", async () => {
	const parent = await createFolder(POSTS, null, "Parent");
	const child = await createFolder(POSTS, parent.id, "Child");
	const earlier = await createEntry({ folder_id: child.id });
	const other = await createEntry({ folder_id: parent.id });
	await trashEarlier("entries", earlier.id);
	await moveToTrash(parent.id);
	const before = {
		parent: await trashedAtText("folders", parent.id),
		child: await trashedAtText("folders", child.id),
		other: await trashedAtText("entries", other.id),
	};

	await montiOf(false).trash.restore({ id: earlier.id });
	const active = await db.selectFrom("folders").selectAll().where("trashed_at", "is", null).orderBy("name").execute();
	const [newChild, newParent] = active;

	// TRH-RST-3.1
	expect(active.map(({ id, scope, name }) => ({ scope, name, isNew: ![parent.id, child.id].includes(id) }))).toEqual([
		{ scope: POSTS, name: "Child", isNew: true },
		{ scope: POSTS, name: "Parent", isNew: true },
	]);
	// TRH-RST-3.2
	expect(newChild.parent_id).toBe(newParent.id);
	// TRH-RST-3.3
	expect(await entryRow(earlier.id)).toMatchObject({ trashed_at: null, folder_id: newChild.id });
	// TRH-RST-3.4
	expect({
		parent: await trashedAtText("folders", parent.id),
		child: await trashedAtText("folders", child.id),
		other: await trashedAtText("entries", other.id),
	}).toEqual(before);
});

it("TRH-RST-4 restores an entry whose folder is in the trash into the active folder of the same name at the same place", async () => {
	const folder = await createFolder(POSTS, null, "Docs");
	const earlier = await createEntry({ folder_id: folder.id });
	await trashEarlier("entries", earlier.id);
	await moveToTrash(folder.id);
	const existing = await createFolder(POSTS, null, "Docs");

	await montiOf(false).trash.restore({ id: earlier.id });
	const twins = await db
		.selectFrom("folders")
		.select("id")
		.where("scope", "=", POSTS)
		.where("parent_id", "is", null)
		.where("name", "=", "Docs")
		.where("trashed_at", "is", null)
		.execute();

	// TRH-RST-4.1
	expect(twins).toEqual([{ id: existing.id }]);
	// TRH-RST-4.2
	expect(await entryRow(earlier.id)).toMatchObject({ trashed_at: null, folder_id: existing.id });
});

it("TRH-RST-5 restores a folder under a numbered name when an active folder at the same place has its name", async () => {
	const folder = await createFolder(POSTS, null, "Docs");
	const inside = await createEntry({ folder_id: folder.id });
	await moveToTrash(folder.id);
	const active = await createFolder(POSTS, null, "Docs");

	await montiOf(false).trash.restore({ id: folder.id });

	// TRH-RST-5.1
	expect(await folderRow(folder.id)).toMatchObject({ name: "Docs-2", trashed_at: null });
	// TRH-RST-5.2
	expect(await entryRow(inside.id)).toMatchObject({ trashed_at: null, folder_id: folder.id });
	// TRH-RST-5.3
	expect((await folderRow(active.id))?.name).toBe("Docs");
});

it("TRH-RST-6 restores an entry under a numbered slug when an active entry has its slug", async () => {
	const trashed = await createEntry({ slug: "hello" });
	await moveToTrash(trashed.id);
	const active = await createEntry({ slug: "hello" });

	await montiOf(false).trash.restore({ id: trashed.id });

	// TRH-RST-6.1
	expect({
		slug: (await localeRows(trashed.id))[0].slug,
		trashed_at: (await entryRow(trashed.id))?.trashed_at,
	}).toEqual({ slug: "hello-2", trashed_at: null });
	// TRH-RST-6.2
	expect((await localeRows(active.id))[0].slug).toBe("hello");
});

it("TRH-RST-7 restores a media from the trash", async () => {
	const item = await createMedia();
	await moveToTrash(item.id);

	const output = await montiOf().trash.restore({ id: item.id });

	// TRH-RST-7.1
	expect((await mediaRow(item.id))?.trashed_at).toBeNull();
	// TRH-RST-7.2
	expect(output).toEqual({ kind: "media", id: item.id });
});

it("TRH-RST-8 rejects restoring an id that is not in the trash with NOT_FOUND", async () => {
	const entry = await createEntry();

	// TRH-RST-8.1
	await expect(montiOf().trash.restore({ id: entry.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("TRH-DEL-1 deletes an entry with every locale's working and published copies and its media_uses rows", async () => {
	const item = await createMedia();
	const entry = await createPublishedEntry({ mediaId: item.id });
	await moveToTrash(entry.id);

	await montiOf().trash.delete({ id: entry.id });

	// TRH-DEL-1.1
	expect({
		entry: await entryRow(entry.id),
		locales: await localeRows(entry.id),
		published: await publishedRows(entry.id),
	}).toEqual({ entry: undefined, locales: [], published: [] });
	// TRH-DEL-1.2
	expect(await usesOfEntry(entry.id)).toEqual([]);
});

it("TRH-DEL-2 deletes a media from the database and puts its file in loose_files", async () => {
	const item = await createMedia();
	await createEntry({ mediaId: item.id });
	await moveToTrash(item.id);

	await montiOf().trash.delete({ id: item.id });
	const finishedAt = Date.now();
	const loose = await looseFile(item.key);

	// TRH-DEL-2.1
	expect(await mediaRow(item.id)).toBeUndefined();
	// TRH-DEL-2.2
	expect(await usesOfMedia(item.id)).toEqual([]);
	// TRH-DEL-2.3
	expect({
		key: loose?.key,
		notLater: (loose?.remove_after.getTime() ?? Number.POSITIVE_INFINITY) <= finishedAt,
	}).toEqual({ key: item.key, notLater: true });
	// TRH-DEL-2.4
	expect(storage.removed).toEqual([]);
});

it("TRH-DEL-3 deletes a collection folder with what went in with it and leaves an entry trashed earlier in the trash", async () => {
	const item = await createMedia();
	const folder = await createFolder(POSTS);
	const child = await createFolder(POSTS, folder.id);
	const inside = await createEntry({ folder_id: folder.id, mediaId: item.id });
	const earlier = await createEntry({ folder_id: folder.id });
	await trashEarlier("entries", earlier.id);
	const earlierAt = await trashedAtText("entries", earlier.id);
	await moveToTrash(folder.id);

	await montiOf().trash.delete({ id: folder.id });

	// TRH-DEL-3.1
	expect({ folder: await folderRow(folder.id), child: await folderRow(child.id) }).toEqual({
		folder: undefined,
		child: undefined,
	});
	// TRH-DEL-3.2
	expect({ entry: await entryRow(inside.id), uses: await usesOfEntry(inside.id) }).toEqual({
		entry: undefined,
		uses: [],
	});
	// TRH-DEL-3.3
	expect({
		trashed_at: await trashedAtText("entries", earlier.id),
		folder_id: (await entryRow(earlier.id))?.folder_id,
	}).toEqual({ trashed_at: earlierAt, folder_id: null });
});

it("TRH-DEL-4 deletes a media folder with its subfolder and media and puts the media's file in loose_files", async () => {
	const folder = await createFolder("media");
	const child = await createFolder("media", folder.id);
	const item = await createMedia(folder.id);
	await createEntry({ mediaId: item.id });
	await moveToTrash(folder.id);

	await montiOf().trash.delete({ id: folder.id });
	const finishedAt = Date.now();
	const loose = await looseFile(item.key);

	// TRH-DEL-4.1
	expect({
		folder: await folderRow(folder.id),
		child: await folderRow(child.id),
		media: await mediaRow(item.id),
	}).toEqual({ folder: undefined, child: undefined, media: undefined });
	// TRH-DEL-4.2
	expect(await usesOfMedia(item.id)).toEqual([]);
	// TRH-DEL-4.3
	expect({
		key: loose?.key,
		notLater: (loose?.remove_after.getTime() ?? Number.POSITIVE_INFINITY) <= finishedAt,
	}).toEqual({ key: item.key, notLater: true });
});

it("TRH-DEL-5 deletes several items at once", async () => {
	const entry = await createEntry();
	const folder = await createFolder(POSTS);
	await moveToTrash(entry.id);
	await moveToTrash(folder.id);

	const output = await montiOf(false).trash.delete({ ids: [entry.id, folder.id] });
	const items = Array.isArray(output) ? output : [output];

	// TRH-DEL-5.1
	expect({ entry: await entryRow(entry.id), folder: await folderRow(folder.id) }).toEqual({
		entry: undefined,
		folder: undefined,
	});
	// TRH-DEL-5.2
	expect([...items].sort(byId)).toEqual(
		[
			{ kind: "entry", id: entry.id },
			{ kind: "folder", id: folder.id },
		].sort(byId),
	);
});

it("TRH-DEL-6 empties the trash and leaves the active items", async () => {
	const entry = await createEntry();
	const folder = await createFolder(POSTS);
	const active = await createEntry();
	await moveToTrash(entry.id);
	await moveToTrash(folder.id);
	const before = await entryRow(active.id);

	await montiOf(false).trash.delete({ all: true });

	// TRH-DEL-6.1
	expect({ entry: await entryRow(entry.id), folder: await folderRow(folder.id) }).toEqual({
		entry: undefined,
		folder: undefined,
	});
	// TRH-DEL-6.2
	expect(await entryRow(active.id)).toEqual(before);
});

it("TRH-DEL-7 deletes only the items trashed before the given time", async () => {
	const older = await createEntry();
	const newer = await createEntry();
	await trashEarlier("entries", older.id, 2);
	await moveToTrash(newer.id);
	const before = await entryRow(newer.id);

	await montiOf(false).trash.delete({ before: new Date(Date.now() - 60 * 60 * 1000).toISOString() });

	// TRH-DEL-7.1
	expect(await entryRow(older.id)).toBeUndefined();
	// TRH-DEL-7.2
	expect(await entryRow(newer.id)).toEqual(before);
});

it("TRH-DEL-8 rejects with NOT_FOUND and deletes nothing when one of the ids is not in the trash", async () => {
	const trashed = await createEntry();
	const active = await createEntry();
	await moveToTrash(trashed.id);
	const before = { trashed: await entryRow(trashed.id), active: await entryRow(active.id) };

	// TRH-DEL-8.1
	await expect(montiOf(false).trash.delete({ ids: [trashed.id, active.id] })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// TRH-DEL-8.2
	expect({ trashed: await entryRow(trashed.id), active: await entryRow(active.id) }).toEqual(before);
});
