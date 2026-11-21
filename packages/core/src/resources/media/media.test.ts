import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../__test__/database";
import { createMemoryStorage, type MemoryStorage } from "../../__test__/memory-storage";
import { migrate } from "../../db/migrate";
import { initial } from "../../db/migrations/0001-initial";
import type { Database } from "../../db/types";
import { createMonti } from "../../engine/engine";
import { removeLooseFiles } from "./loose-files";
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
	filename?: string;
	width?: number | null;
	height?: number | null;
	trashed?: boolean;
}

/** Inserts a media row straight into the table and returns it. */
async function seedMedia(seed: MediaSeed = {}) {
	const row = {
		id: randomUUID(),
		folder_id: seed.folder_id ?? null,
		key: seed.key ?? randomUUID(),
		filename: seed.filename ?? "image.png",
		mime_type: "image/png",
		size: 1024,
		width: seed.width ?? null,
		height: seed.height ?? null,
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

it("MED-UPL-1 issues an upload ticket for a new UUID key and records it in loose_files for 24 hours", async () => {
	const startedAt = Date.now();
	const output = await montiOf().media.startUpload({ mime_type: "image/png", size: 1024 });
	const row = await looseFile(output.key);

	// MED-UPL-1.1
	expect(output.key).toMatch(UUID);
	// MED-UPL-1.2
	expect(storage.tickets).toEqual([{ key: output.key, info: { mime: "image/png", size: 1024 } }]);
	// MED-UPL-1.3
	expect({ url: output.url, headers: output.headers }).toEqual({
		url: `memory://upload/${output.key}`,
		headers: { "content-type": "image/png" },
	});
	// MED-UPL-1.4
	expect(row?.key).toBe(output.key);
	// MED-UPL-1.5
	expect(Math.abs((row?.remove_after.getTime() ?? 0) - startedAt - DAY_MS)).toBeLessThan(5000);
});

it("MED-UPL-2 rejects media.startUpload with BAD_REQUEST on an engine without storage", async () => {
	// MED-UPL-2.1
	await expect(montiOf(false).media.startUpload({ mime_type: "image/png", size: 1024 })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// MED-UPL-2.2
	expect(await looseKeys()).toEqual([]);
});

it("MED-CRT-1 스토리지 파일을 확인해 미디어로 등록하고 임시 목록에서 해당 키만 지운다", async () => {
	const key = randomUUID();
	const other = randomUUID();
	storage.seed(key, { mime: "image/webp", size: 2048 });
	await seedLooseFile(key);
	await seedLooseFile(other);

	const output = await montiOf().media.create({ key });
	const row = await mediaRow(output.id);

	// MED-CRT-1.1
	expect({
		key: output.key,
		filename: output.filename,
		mime_type: output.mime_type,
		size: output.size,
		folder_id: output.folder_id,
		width: output.width,
		height: output.height,
	}).toEqual({
		key,
		filename: key,
		mime_type: "image/webp",
		size: 2048,
		folder_id: null,
		width: null,
		height: null,
	});
	// MED-CRT-1.2
	expect(output.url).toBe(`memory://${key}`);
	// MED-CRT-1.3
	expect({
		id: row.id,
		key: row.key,
		filename: row.filename,
		mime_type: row.mime_type,
		size: row.size,
		folder_id: row.folder_id,
		width: row.width,
		height: row.height,
	}).toEqual({
		id: output.id,
		key,
		filename: key,
		mime_type: "image/webp",
		size: 2048,
		folder_id: null,
		width: null,
		height: null,
	});
	// MED-CRT-1.4
	expect(await looseFile(key)).toBeUndefined();
	// MED-CRT-1.5
	expect(await looseKeys()).toEqual([other]);
});

it("MED-CRT-3 rejects media.create with BAD_REQUEST for a key not in the storage", async () => {
	// MED-CRT-3.1
	await expect(montiOf().media.create({ key: randomUUID() })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// MED-CRT-3.2
	expect(await mediaRows()).toEqual([]);
});

it("MED-CRT-4 rejects media.create with CONFLICT for a key already in media, trashed rows included", async () => {
	const key = randomUUID();
	storage.seed(key, { mime: "image/png", size: 10 });
	const trashed = await seedMedia({ key, trashed: true });

	// MED-CRT-4.1
	await expect(montiOf().media.create({ key })).rejects.toMatchObject({ code: "CONFLICT" });
	// MED-CRT-4.2
	expect((await mediaRows()).map((row) => row.id)).toEqual([trashed.id]);
});

it("MED-CRT-5 rejects media.create with BAD_REQUEST for a folder outside the media scope", async () => {
	const key = randomUUID();
	storage.seed(key, { mime: "image/png", size: 10 });
	const folder = await seedFolder(POSTS);

	// MED-CRT-5.1
	await expect(montiOf().media.create({ key, folder_id: folder })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// MED-CRT-5.2
	expect(await mediaRows()).toEqual([]);
});

it("MED-READ-1 lists only the media directly in the given folder", async () => {
	const folder = await seedFolder("media");
	const child = await seedFolder("media", folder);
	const direct = await seedMedia({ folder_id: folder });
	await seedMedia({ folder_id: child });
	await seedMedia();

	const output = await montiOf().media.list({ folder_id: folder });

	// MED-READ-1.1
	expect(output.map((item) => item.id)).toEqual([direct.id]);
});

it("MED-READ-2 lists only the media at the root for a null folder_id", async () => {
	const folder = await seedFolder("media");
	const root = await seedMedia();
	await seedMedia({ folder_id: folder });

	const output = await montiOf().media.list({ folder_id: null });

	// MED-READ-2.1
	expect(output.map((item) => item.id)).toEqual([root.id]);
});

it("MED-READ-3 lists every media not trashed, with its url, when called without an input", async () => {
	const folder = await seedFolder("media");
	const root = await seedMedia();
	const inFolder = await seedMedia({ folder_id: folder });
	await seedMedia({ trashed: true });

	const output = await montiOf().media.list();

	// MED-READ-3.1
	expect(output.map((item) => item.id).sort()).toEqual([root.id, inFolder.id].sort());
	// MED-READ-3.2
	expect(Object.fromEntries(output.map((item) => [item.id, item.url]))).toEqual({
		[root.id]: storage.url(root.key),
		[inFolder.id]: storage.url(inFolder.key),
	});
});

it("MED-READ-4 활성 미디어 1건을 URL 및 사용처 목록과 함께 돌려준다", async () => {
	const row = await seedMedia();
	const use = { source_kind: "entry" as const, source_id: randomUUID(), field_path: "title" };
	await db
		.insertInto("media_uses")
		.values({ media_id: row.id, ...use })
		.execute();

	const output = await montiOf().media.get({ id: row.id });

	// MED-READ-4.1
	expect(output.id).toBe(row.id);
	// MED-READ-4.2
	expect(output.url).toBe(`memory://${row.key}`);
	// MED-READ-4.3
	expect(output.uses).toEqual([use]);
});

it("MED-READ-5 rejects media.get with NOT_FOUND for a trashed media", async () => {
	const row = await seedMedia({ trashed: true });

	// MED-READ-5.1
	await expect(montiOf().media.get({ id: row.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("MED-UPD-1 단건 수정에서 파일 정보만 주면 지정한 열을 바꾸고 폴더와 파일 키는 유지한다", async () => {
	const folder = await seedFolder("media");
	const row = await seedMedia({ folder_id: folder, filename: "old.png", width: 100, height: 50 });
	const fresh = { filename: "new.png", width: 640, height: 480 };

	const output = await montiOf().media.update({ id: row.id, ...fresh });
	const stored = await mediaRow(row.id);

	// MED-UPD-1.1
	expect(output).toMatchObject(fresh);
	// MED-UPD-1.2
	expect(output).toMatchObject({ folder_id: folder });
	// MED-UPD-1.3
	expect(output).toMatchObject({ key: row.key });
	// MED-UPD-1.4
	expect({ filename: stored.filename, width: stored.width, height: stored.height }).toEqual(fresh);
});

it("MED-UPD-2 단건 수정에서 새 파일 키로 교체하면 MIME·용량·URL을 갱신하고 이전 키를 임시 목록에 넣는다", async () => {
	const row = await seedMedia();
	const key = randomUUID();
	storage.seed(key, { mime: "image/jpeg", size: 30 });
	await seedLooseFile(key);

	const startedAt = Date.now();
	const output = await montiOf().media.update({ id: row.id, key });
	const stored = await mediaRow(row.id);
	const old = await looseFile(row.key);

	// MED-UPD-2.1
	expect(output).toMatchObject({ key, mime_type: "image/jpeg", size: 30 });
	// MED-UPD-2.2
	expect(output).toMatchObject({ url: `memory://${key}` });
	// MED-UPD-2.3
	expect({ key: stored.key, mime_type: stored.mime_type, size: stored.size }).toEqual({
		key,
		mime_type: "image/jpeg",
		size: 30,
	});
	// MED-UPD-2.4
	expect(await looseFile(key)).toBeUndefined();
	// MED-UPD-2.5
	expect(old?.key).toBe(row.key);
	// MED-UPD-2.6
	expect(Math.abs((old?.remove_after.getTime() ?? 0) - startedAt - DAY_MS)).toBeLessThan(5000);
});

it("MED-UPD-3 moves the given ids to one folder", async () => {
	const first = await seedMedia();
	const second = await seedMedia();
	const folder = await seedFolder("media");

	const output = await montiOf().media.update({ ids: [first.id, second.id], folder_id: folder });
	const items = Array.isArray(output) ? output : [output];
	const stored = await Promise.all([mediaRow(first.id), mediaRow(second.id)]);

	// MED-UPD-3.1
	expect(items.map((item) => ({ id: item.id, folder_id: item.folder_id })).sort(byId)).toEqual(
		[
			{ id: first.id, folder_id: folder },
			{ id: second.id, folder_id: folder },
		].sort(byId),
	);
	// MED-UPD-3.2
	expect(stored.map((row) => row.folder_id)).toEqual([folder, folder]);
});

it("MED-UPD-4 rolls the bulk move back with NOT_FOUND when one of the ids is trashed", async () => {
	const active = await seedMedia();
	const trashed = await seedMedia({ trashed: true });
	const folder = await seedFolder("media");

	// MED-UPD-4.1
	await expect(montiOf().media.update({ ids: [active.id, trashed.id], folder_id: folder })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// MED-UPD-4.2
	expect((await mediaRow(active.id)).folder_id).toBeNull();
});

it("MED-UPD-5 단건 수정에서 파일 이름을 빈 문자열로 바꿀 수 없다", async () => {
	const row = await seedMedia({ filename: "image.png" });

	// MED-UPD-5.1
	await expect(montiOf().media.update({ id: row.id, filename: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// MED-UPD-5.2
	expect((await mediaRow(row.id)).filename).toBe("image.png");
});

it("MED-CRT-2 registers the media with the given __preset_id", async () => {
	const id = randomUUID();
	const key = randomUUID();
	storage.seed(key, { mime: "image/png", size: 1024 });

	const output = await montiOf().media.create({ __preset_id: id, key });

	// MED-CRT-2.1
	expect(output.id).toBe(id);
	// MED-CRT-2.2
	expect((await mediaRows()).map((row) => row.id)).toEqual([id]);
});

function byId(a: { id: string }, b: { id: string }): number {
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Puts `key` in loose_files with `remove_after` an hour before or after now. */
async function seedLooseFileAt(key: string, hours: number): Promise<void> {
	await db
		.insertInto("loose_files")
		.values({ key, remove_after: new Date(Date.now() + hours * 60 * 60 * 1000) })
		.execute();
}

it("MED-CLN-1 removes only the loose files past remove_after from the storage and from loose_files", async () => {
	const past = randomUUID();
	const future = randomUUID();
	await seedLooseFileAt(past, -1);
	await seedLooseFileAt(future, 1);
	const kept = await looseFile(future);

	await removeLooseFiles({ db, storage });

	// MED-CLN-1.1
	expect({ removed: storage.removed.includes(past), row: await looseFile(past) }).toEqual({
		removed: true,
		row: undefined,
	});
	// MED-CLN-1.2
	expect({ removed: storage.removed.includes(future), row: await looseFile(future) }).toEqual({
		removed: false,
		row: kept,
	});
});

it("MED-CLN-2 keeps a loose file the storage failed to remove and goes on with the rest", async () => {
	const failing = randomUUID();
	const removable = randomUUID();
	await seedLooseFileAt(failing, -1);
	await seedLooseFileAt(removable, -1);
	const flaky = {
		...storage,
		remove: async (key: string) => {
			if (key === failing) throw new Error("The storage is unreachable");
			await storage.remove(key);
		},
	};

	const run = removeLooseFiles({ db, storage: flaky });

	// MED-CLN-2.3
	await expect(run).resolves.toBeUndefined();
	// MED-CLN-2.1
	expect(await looseFile(removable)).toBeUndefined();
	// MED-CLN-2.2
	expect((await looseFile(failing))?.key).toBe(failing);
});
