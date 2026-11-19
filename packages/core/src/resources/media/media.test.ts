import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../__test__/database";
import { createMemoryStorage, type MemoryStorage } from "../../__test__/memory-storage";
import { migrate } from "../../db/migrate";
import { initial } from "../../db/migrations/0001-initial";
import type { Database } from "../../db/types";
import { createMonti } from "../../engine/engine";
import { media } from "./media";

let testDb: TestDatabase;
let db: Kysely<Database>;
let storage: MemoryStorage;

const POSTS = "posts";
const DAY_MS = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function montiOf(withStorage = true) {
	return createMonti(db, { media }, [], {
		schema: { locales: ["ko"], collections: { [POSTS]: { fields: { title: { type: "text" } } } } },
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

async function seedFolder(scope: string, parent_id: string | null = null): Promise<string> {
	const id = randomUUID();
	await db.insertInto("folders").values({ id, scope, name: "Folder", parent_id }).execute();
	return id;
}

interface MediaSeed {
	folder_id?: string | null;
	key?: string;
	metadata?: Record<string, unknown>;
	trashed?: boolean;
}

/** Inserts a media row straight into the table and returns it. */
async function seedMedia(seed: MediaSeed = {}) {
	const row = {
		id: randomUUID(),
		folder_id: seed.folder_id ?? null,
		key: seed.key ?? randomUUID(),
		mime_type: "image/png",
		metadata: JSON.stringify(seed.metadata ?? {}),
		trashed_at: seed.trashed === true ? new Date() : null,
	};
	await db.insertInto("media").values(row).execute();
	return row;
}

async function seedLooseFile(key: string): Promise<void> {
	await db
		.insertInto("loose_files")
		.values({ key, remove_after: new Date(Date.now() + DAY_MS) })
		.execute();
}

async function mediaRows() {
	return db.selectFrom("media").selectAll().execute();
}

async function mediaRow(id: string) {
	return db.selectFrom("media").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
}

async function looseKeys(): Promise<string[]> {
	const rows = await db.selectFrom("loose_files").select("key").execute();
	return rows.map((row) => row.key);
}

async function looseFile(key: string) {
	return db.selectFrom("loose_files").selectAll().where("key", "=", key).executeTakeFirst();
}

it("MED-1 issues an upload ticket for a new UUID key and records it in loose_files for 24 hours", async () => {
	const startedAt = Date.now();
	const output = await montiOf().media.startUpload({ mime_type: "image/png", size: 1024 });
	const row = await looseFile(output.key);

	// MED-1.1
	expect(output.key).toMatch(UUID);
	// MED-1.2
	expect(storage.tickets).toEqual([{ key: output.key, info: { mime: "image/png", size: 1024 } }]);
	// MED-1.3
	expect({ url: output.url, headers: output.headers }).toEqual({
		url: `memory://upload/${output.key}`,
		headers: { "content-type": "image/png" },
	});
	// MED-1.4
	expect(row?.key).toBe(output.key);
	// MED-1.5
	expect(Math.abs((row?.remove_after.getTime() ?? 0) - startedAt - DAY_MS)).toBeLessThan(5000);
});

it("MED-2 rejects media.startUpload with BAD_REQUEST on an engine without storage", async () => {
	// MED-2.1
	await expect(montiOf(false).media.startUpload({ mime_type: "image/png", size: 1024 })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// MED-2.2
	expect(await looseKeys()).toEqual([]);
});

it("MED-3 registers an uploaded file and removes only its key from loose_files", async () => {
	const key = randomUUID();
	const other = randomUUID();
	storage.seed(key, { mime: "image/webp", size: 2048 });
	await seedLooseFile(key);
	await seedLooseFile(other);

	const output = await montiOf().media.create({ key });
	const row = await mediaRow(output.id);

	// MED-3.1
	expect({
		key: output.key,
		mime_type: output.mime_type,
		folder_id: output.folder_id,
		metadata: output.metadata,
	}).toEqual({ key, mime_type: "image/webp", folder_id: null, metadata: {} });
	// MED-3.2
	expect(output.url).toBe(`memory://${key}`);
	// MED-3.3
	expect({
		id: row.id,
		key: row.key,
		mime_type: row.mime_type,
		folder_id: row.folder_id,
		metadata: row.metadata,
	}).toEqual({ id: output.id, key, mime_type: "image/webp", folder_id: null, metadata: {} });
	// MED-3.4
	expect(await looseFile(key)).toBeUndefined();
	// MED-3.5
	expect(await looseKeys()).toEqual([other]);
});

it("MED-4 rejects media.create with BAD_REQUEST for a key not in the storage", async () => {
	// MED-4.1
	await expect(montiOf().media.create({ key: randomUUID() })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// MED-4.2
	expect(await mediaRows()).toEqual([]);
});

it("MED-5 rejects media.create with CONFLICT for a key already in media, trashed rows included", async () => {
	const key = randomUUID();
	storage.seed(key, { mime: "image/png", size: 10 });
	const trashed = await seedMedia({ key, trashed: true });

	// MED-5.1
	await expect(montiOf().media.create({ key })).rejects.toMatchObject({ code: "CONFLICT" });
	// MED-5.2
	expect((await mediaRows()).map((row) => row.id)).toEqual([trashed.id]);
});

it("MED-6 rejects media.create with BAD_REQUEST for a folder outside the media scope", async () => {
	const key = randomUUID();
	storage.seed(key, { mime: "image/png", size: 10 });
	const folder = await seedFolder(POSTS);

	// MED-6.1
	await expect(montiOf().media.create({ key, folder_id: folder })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// MED-6.2
	expect(await mediaRows()).toEqual([]);
});

it("MED-7 lists only the media directly in the given folder", async () => {
	const folder = await seedFolder("media");
	const child = await seedFolder("media", folder);
	const direct = await seedMedia({ folder_id: folder });
	await seedMedia({ folder_id: child });
	await seedMedia();

	const output = await montiOf().media.list({ folder_id: folder });

	// MED-7.1
	expect(output.map((item) => item.id)).toEqual([direct.id]);
});

it("MED-8 lists only the media at the root for a null folder_id", async () => {
	const folder = await seedFolder("media");
	const root = await seedMedia();
	await seedMedia({ folder_id: folder });

	const output = await montiOf().media.list({ folder_id: null });

	// MED-8.1
	expect(output.map((item) => item.id)).toEqual([root.id]);
});

it("MED-9 lists every media not trashed, with its url, when called without an input", async () => {
	const folder = await seedFolder("media");
	const root = await seedMedia();
	const inFolder = await seedMedia({ folder_id: folder });
	await seedMedia({ trashed: true });

	const output = await montiOf().media.list();

	// MED-9.1
	expect(output.map((item) => item.id).sort()).toEqual([root.id, inFolder.id].sort());
	// MED-9.2
	expect(Object.fromEntries(output.map((item) => [item.id, item.url]))).toEqual({
		[root.id]: storage.url(root.key),
		[inFolder.id]: storage.url(inFolder.key),
	});
});

it("MED-10 gets one media not trashed, with its url", async () => {
	const row = await seedMedia();

	const output = await montiOf().media.get({ id: row.id });

	// MED-10.1
	expect(output.id).toBe(row.id);
	// MED-10.2
	expect(output.url).toBe(`memory://${row.key}`);
});

it("MED-11 rejects media.get with NOT_FOUND for a trashed media", async () => {
	const row = await seedMedia({ trashed: true });

	// MED-11.1
	await expect(montiOf().media.get({ id: row.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("MED-12 replaces the metadata wholesale and keeps the omitted folder_id and key", async () => {
	const folder = await seedFolder("media");
	const row = await seedMedia({ folder_id: folder, metadata: { alt: "Old" } });

	const output = await montiOf().media.update({ id: row.id, metadata: { caption: "New" } });
	const stored = await mediaRow(row.id);

	// MED-12.1
	expect(Array.isArray(output) ? undefined : output.metadata).toEqual({ caption: "New" });
	// MED-12.2
	expect(output).toMatchObject({ folder_id: folder });
	// MED-12.3
	expect(output).toMatchObject({ key: row.key });
	// MED-12.4
	expect(stored.metadata).toEqual({ caption: "New" });
});

it("MED-13 replaces the file, updating mime_type and url, and puts the old key in loose_files", async () => {
	const row = await seedMedia();
	const key = randomUUID();
	storage.seed(key, { mime: "image/jpeg", size: 30 });
	await seedLooseFile(key);

	const startedAt = Date.now();
	const output = await montiOf().media.update({ id: row.id, key });
	const stored = await mediaRow(row.id);
	const old = await looseFile(row.key);

	// MED-13.1
	expect(output).toMatchObject({ key, mime_type: "image/jpeg" });
	// MED-13.2
	expect(output).toMatchObject({ url: `memory://${key}` });
	// MED-13.3
	expect({ key: stored.key, mime_type: stored.mime_type }).toEqual({ key, mime_type: "image/jpeg" });
	// MED-13.4
	expect(await looseFile(key)).toBeUndefined();
	// MED-13.5
	expect(old?.key).toBe(row.key);
	// MED-13.6
	expect(Math.abs((old?.remove_after.getTime() ?? 0) - startedAt - DAY_MS)).toBeLessThan(5000);
});

it("MED-14 moves the given ids to one folder", async () => {
	const first = await seedMedia();
	const second = await seedMedia();
	const folder = await seedFolder("media");

	const output = await montiOf().media.update({ ids: [first.id, second.id], folder_id: folder });
	const items = Array.isArray(output) ? output : [output];
	const stored = await Promise.all([mediaRow(first.id), mediaRow(second.id)]);

	// MED-14.1
	expect(items.map((item) => ({ id: item.id, folder_id: item.folder_id })).sort(byId)).toEqual(
		[
			{ id: first.id, folder_id: folder },
			{ id: second.id, folder_id: folder },
		].sort(byId),
	);
	// MED-14.2
	expect(stored.map((row) => row.folder_id)).toEqual([folder, folder]);
});

it("MED-15 rolls the bulk move back with NOT_FOUND when one of the ids is trashed", async () => {
	const active = await seedMedia();
	const trashed = await seedMedia({ trashed: true });
	const folder = await seedFolder("media");

	// MED-15.1
	await expect(montiOf().media.update({ ids: [active.id, trashed.id], folder_id: folder })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// MED-15.2
	expect((await mediaRow(active.id)).folder_id).toBeNull();
});

it("MED-16 registers the media with the given __preset_id", async () => {
	const id = randomUUID();
	const key = randomUUID();
	storage.seed(key, { mime: "image/png", size: 1024 });

	const output = await montiOf().media.create({ __preset_id: id, key });

	// MED-16.1
	expect(output.id).toBe(id);
	// MED-16.2
	expect((await mediaRows()).map((row) => row.id)).toEqual([id]);
});

function byId(a: { id: string }, b: { id: string }): number {
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
