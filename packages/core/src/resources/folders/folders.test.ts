import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../__test__/database";
import { migrate } from "../../db/migrate";
import { initial } from "../../db/migrations/0001-initial";
import type { Database } from "../../db/types";
import { createMonti } from "../../engine/engine";
import { folders } from "./folders";

let testDb: TestDatabase;
let db: Kysely<Database>;

const POSTS = "posts";
const MEDIA = "media";

function montiOf() {
	return createMonti(db, { folders }, [], {
		schema: { locales: ["ko"], collections: { [POSTS]: { fields: { title: { type: "text" } } } } },
		config: { name: "Monti Blog", dev: false },
		schemaFile: "unused-schema-file",
		configFile: "unused-config-file",
	});
}

beforeEach(async () => {
	testDb = await createTestDatabase();
	await migrate(testDb.db, "core", [initial]);
	db = testDb.db as Kysely<Database>;
});

afterEach(async () => {
	await testDb.drop();
});

interface Seed {
	scope?: string;
	name?: string;
	parent_id?: string | null;
	trashed?: boolean;
}

/** Inserts a folder straight into the table and returns its id. */
async function seedFolder(seed: Seed = {}): Promise<string> {
	const id = randomUUID();
	await db
		.insertInto("folders")
		.values({
			id,
			scope: seed.scope ?? POSTS,
			name: seed.name ?? "Folder",
			parent_id: seed.parent_id ?? null,
			trashed_at: seed.trashed === true ? new Date() : null,
		})
		.execute();
	return id;
}

async function folderRows() {
	return db.selectFrom("folders").selectAll().execute();
}

async function folderRow(id: string) {
	return db.selectFrom("folders").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
}

it("FLD-CRT-1 creates a root folder in a collection scope", async () => {
	const output = await montiOf().folders.create({ scope: POSTS, name: "Drafts" });
	const rows = await folderRows();

	// FLD-CRT-1.1
	expect(output.scope).toBe(POSTS);
	// FLD-CRT-1.2
	expect(output.name).toBe("Drafts");
	// FLD-CRT-1.3
	expect(output.parent_id).toBeNull();
	// FLD-CRT-1.4
	expect(rows.map((row) => row.id)).toEqual([output.id]);
});

it("FLD-CRT-2 creates a child folder in the media scope with the given __preset_id", async () => {
	const root = await seedFolder({ scope: MEDIA, name: "Root" });
	const id = randomUUID();

	const output = await montiOf().folders.create({ __preset_id: id, scope: MEDIA, name: "Photos", parent_id: root });

	// FLD-CRT-2.1
	expect(output.id).toBe(id);
	// FLD-CRT-2.2
	expect(output.parent_id).toBe(root);
	// FLD-CRT-2.3
	expect((await folderRow(id)).parent_id).toBe(root);
});

it("FLD-CRT-3 rejects folders.create with BAD_REQUEST for a scope not in the schema", async () => {
	// FLD-CRT-3.1
	await expect(montiOf().folders.create({ scope: "constructor", name: "Drafts" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// FLD-CRT-3.2
	expect(await folderRows()).toEqual([]);
});

it("FLD-CRT-4 rejects folders.create with BAD_REQUEST for a trashed parent", async () => {
	const trashed = await seedFolder({ trashed: true });

	// FLD-CRT-4.1
	await expect(montiOf().folders.create({ scope: POSTS, name: "Child", parent_id: trashed })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// FLD-CRT-4.2
	expect((await folderRows()).map((row) => row.id)).toEqual([trashed]);
});

it("FLD-CRT-5 rejects folders.create with BAD_REQUEST for a parent that does not exist", async () => {
	const active = await seedFolder();

	// FLD-CRT-5.1
	await expect(
		montiOf().folders.create({ scope: POSTS, name: "Child", parent_id: randomUUID() }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// FLD-CRT-5.2
	expect((await folderRows()).map((row) => row.id)).toEqual([active]);
});

it("FLD-LST-1 lists only the scope's folders whose trashed_at is null", async () => {
	const active = await seedFolder({ name: "Active" });
	await seedFolder({ name: "Trashed", trashed: true });
	await seedFolder({ scope: MEDIA, name: "Photos" });

	const output = await montiOf().folders.list({ scope: POSTS });

	// FLD-LST-1.1
	expect(output.map((folder) => folder.id)).toEqual([active]);
});

it("FLD-UPD-1 renames a folder and moves it under another folder", async () => {
	const first = await seedFolder({ name: "First" });
	const second = await seedFolder({ name: "Second" });

	const output = await montiOf().folders.update({ id: second, name: "Renamed", parent_id: first });
	const row = await folderRow(second);

	// FLD-UPD-1.1
	expect(output.name).toBe("Renamed");
	// FLD-UPD-1.2
	expect(output.parent_id).toBe(first);
	// FLD-UPD-1.3
	expect(row.name).toBe("Renamed");
	// FLD-UPD-1.4
	expect(row.parent_id).toBe(first);
});

it("FLD-UPD-2 renames a folder without parent_id and keeps its parent", async () => {
	const root = await seedFolder({ name: "Root" });
	const child = await seedFolder({ name: "Child", parent_id: root });

	const output = await montiOf().folders.update({ id: child, name: "Renamed" });
	const row = await folderRow(child);

	// FLD-UPD-2.1
	expect(output.name).toBe("Renamed");
	// FLD-UPD-2.2
	expect(output.parent_id).toBe(root);
	// FLD-UPD-2.3
	expect(row.name).toBe("Renamed");
	// FLD-UPD-2.4
	expect(row.parent_id).toBe(root);
});

it("FLD-UPD-3 moves a folder to the root with a null parent_id", async () => {
	const root = await seedFolder({ name: "Root" });
	const child = await seedFolder({ name: "Child", parent_id: root });

	const output = await montiOf().folders.update({ id: child, parent_id: null });

	// FLD-UPD-3.1
	expect(output.parent_id).toBeNull();
	// FLD-UPD-3.2
	expect((await folderRow(child)).parent_id).toBeNull();
});

it("FLD-UPD-4 rejects folders.update with BAD_REQUEST for a move under itself", async () => {
	const root = await seedFolder();

	// FLD-UPD-4.1
	await expect(montiOf().folders.update({ id: root, parent_id: root })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// FLD-UPD-4.2
	expect((await folderRow(root)).parent_id).toBeNull();
});

it("FLD-UPD-5 rejects folders.update with BAD_REQUEST for a move under a descendant", async () => {
	const root = await seedFolder({ name: "Root" });
	const child = await seedFolder({ name: "Child", parent_id: root });
	const grandchild = await seedFolder({ name: "Grandchild", parent_id: child });

	// FLD-UPD-5.1
	await expect(montiOf().folders.update({ id: root, parent_id: grandchild })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// FLD-UPD-5.2
	expect((await folderRow(root)).parent_id).toBeNull();
});

it("FLD-UPD-6 rejects folders.update with BAD_REQUEST for a parent of another scope", async () => {
	const collectionFolder = await seedFolder();
	const mediaFolder = await seedFolder({ scope: MEDIA });

	// FLD-UPD-6.1
	await expect(montiOf().folders.update({ id: collectionFolder, parent_id: mediaFolder })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// FLD-UPD-6.2
	expect((await folderRow(collectionFolder)).parent_id).toBeNull();
});

it("FLD-UPD-7 rejects folders.update with NOT_FOUND for a trashed folder", async () => {
	await seedFolder({ name: "Active" });
	const trashed = await seedFolder({ name: "Trashed", trashed: true });

	// FLD-UPD-7.1
	await expect(montiOf().folders.update({ id: trashed, name: "Renamed" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// FLD-UPD-7.2
	expect((await folderRow(trashed)).name).toBe("Trashed");
});

it("FLD-CRT-6 rejects folders.create with CONFLICT for an active folder of the same name at the same place", async () => {
	const existing = await seedFolder({ name: "Drafts" });

	// FLD-CRT-6.1
	await expect(montiOf().folders.create({ scope: POSTS, name: "Drafts" })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	// FLD-CRT-6.2
	expect((await folderRows()).map((row) => row.id)).toEqual([existing]);
});

it("FLD-CRT-7 빈 이름으로는 폴더를 만들 수 없다", async () => {
	// FLD-CRT-7.1
	await expect(montiOf().folders.create({ scope: POSTS, name: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// FLD-CRT-7.2
	expect(await folderRows()).toEqual([]);
});

it("FLD-UPD-8 옮긴 위치에 같은 이름의 활성 폴더가 이미 있으면 수정할 수 없다", async () => {
	const root = await seedFolder({ name: "Root" });
	const child = await seedFolder({ name: "Drafts", parent_id: root });
	await seedFolder({ name: "Drafts" });

	// FLD-UPD-8.1
	await expect(montiOf().folders.update({ id: child, parent_id: null })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	// FLD-UPD-8.2
	expect((await folderRow(child)).parent_id).toBe(root);
});

it("FLD-UPD-9 폴더의 이름을 빈 문자열로 바꿀 수 없다", async () => {
	const folder = await seedFolder({ name: "Drafts" });

	// FLD-UPD-9.1
	await expect(montiOf().folders.update({ id: folder, name: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// FLD-UPD-9.2
	expect((await folderRow(folder)).name).toBe("Drafts");
});

it("FLD-UPD-10 바꿀 항목 없이 폴더 수정을 호출하면 기존 폴더를 그대로 돌려준다", async () => {
	const parent = await seedFolder({ name: "Root" });
	const folder = await seedFolder({ name: "Drafts", parent_id: parent });

	const output = await montiOf().folders.update({ id: folder });

	// FLD-UPD-10.1
	expect(output).toEqual({ id: folder, scope: POSTS, name: "Drafts", parent_id: parent });
});
