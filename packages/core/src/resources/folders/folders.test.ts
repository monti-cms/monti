import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../__test__/database";
import { overlap } from "../../__test__/race";
import { migrate } from "../../db/migrate";
import { initial } from "../../db/migrations/0001-initial";
import type { Database } from "../../db/types";
import { createMonti } from "../../engine/engine";
import type { Schema } from "../../engine/types";
import { syncSchemaTables } from "../schema/sync-tables";
import { trash } from "../trash/trash";
import { folders } from "./folders";

let testDb: TestDatabase;
let db: Kysely<Database>;

const POSTS = "posts";
const MEDIA = "media";

const SCHEMA: Schema = { locales: ["ko"], collections: { [POSTS]: { fields: { title: { type: "text" } } } } };

function montiOf() {
	return createMonti(db, { folders, trash }, [], {
		schema: SCHEMA,
		config: { name: "Monti Blog", dev: false },
		schemaFile: "unused-schema-file",
		configFile: "unused-config-file",
	});
}

beforeEach(async () => {
	testDb = await createTestDatabase();
	await migrate(testDb.db, "@monti-cms/core", [initial]);
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

it("FLD-UPD-11 같은 위치의 다른 활성 폴더와 같은 이름으로 바꿀 수 없다", async () => {
	await seedFolder({ name: "Drafts" });
	const second = await seedFolder({ name: "Archive" });

	// FLD-UPD-11.1
	await expect(montiOf().folders.update({ id: second, name: "Drafts" })).rejects.toMatchObject({ code: "CONFLICT" });
	// FLD-UPD-11.2
	expect((await folderRow(second)).name).toBe("Archive");
});

it("FLD-CRT-8 루트에 같은 이름의 폴더를 동시에 두 번 만들면 한 건만 성공하고 나머지는 거절된다", async () => {
	const monti = montiOf();
	const folder = { scope: POSTS, name: "Drafts" };

	// 첫 생성을 커밋 직전에 멈춰 두고 두 번째 생성을 시작한다.
	const [first, second] = await overlap(
		db,
		(hold) =>
			monti.transaction(async (tx) => {
				const created = await tx.folders.create(folder);
				await hold();
				return created;
			}),
		() => monti.folders.create(folder),
	);
	const roots = (await folderRows()).filter((row) => row.name === folder.name && row.parent_id === null);

	// FLD-CRT-8.1
	expect([first.code, second.code].sort()).toEqual(["CONFLICT", null]);
	// FLD-CRT-8.2
	expect(roots.filter((row) => row.scope === POSTS && row.trashed_at === null)).toHaveLength(1);
});

it("FLD-UPD-12 같은 부모 아래의 두 폴더를 같은 이름으로 동시에 바꾸면 한 건만 성공하고 나머지는 거절된다", async () => {
	const parent = await seedFolder({ name: "Parent" });
	const [one, two] = [
		await seedFolder({ name: "One", parent_id: parent }),
		await seedFolder({ name: "Two", parent_id: parent }),
	];
	const monti = montiOf();

	// 첫 수정을 커밋 직전에 멈춰 두고 두 번째 수정을 시작한다.
	const [first, second] = await overlap(
		db,
		(hold) =>
			monti.transaction(async (tx) => {
				const updated = await tx.folders.update({ id: one, name: "Same" });
				await hold();
				return updated;
			}),
		() => monti.folders.update({ id: two, name: "Same" }),
	);
	const named = (await folderRows()).filter((row) => row.parent_id === parent && row.name === "Same");

	// FLD-UPD-12.1
	expect([first.code, second.code].sort()).toEqual(["CONFLICT", null]);
	// FLD-UPD-12.2
	expect(named.filter((row) => row.trashed_at === null)).toHaveLength(1);
});

it("FLD-UPD-13 두 폴더를 서로의 하위 폴더로 동시에 옮겨도 순환 구조가 생기지 않는다", async () => {
	const [one, two] = [await seedFolder({ name: "One" }), await seedFolder({ name: "Two" })];
	const monti = montiOf();

	// 첫 이동을 커밋 직전에 멈춰 두고 두 번째 이동을 시작한다.
	const [first, second] = await overlap(
		db,
		(hold) =>
			monti.transaction(async (tx) => {
				const moved = await tx.folders.update({ id: one, parent_id: two });
				await hold();
				return moved;
			}),
		() => monti.folders.update({ id: two, parent_id: one }),
	);
	const parents = [(await folderRow(one)).parent_id, (await folderRow(two)).parent_id];

	// FLD-UPD-13.1
	expect([first.code, second.code].sort()).toEqual(["BAD_REQUEST", null]);
	// FLD-UPD-13.2
	expect([
		[two, null],
		[null, one],
	]).toContainEqual(parents);
});

it("FLD-UPD-14 폴더를 휴지통에 넣는 동안 그 폴더 아래로 다른 폴더를 옮겨도 휴지통 폴더 아래에 활성 폴더가 남지 않는다", async () => {
	await syncSchemaTables(db, SCHEMA);
	const [discarded, moving] = [await seedFolder({ name: "Discarded" }), await seedFolder({ name: "Moving" })];
	const monti = montiOf();

	// 휴지통 이동을 커밋 직전에 멈춰 두고 폴더 이동을 시작한다.
	const [move] = await overlap(
		db,
		(hold) =>
			monti.transaction(async (tx) => {
				const moved = await tx.trash.move({ id: discarded });
				await hold();
				return moved;
			}),
		() => monti.folders.update({ id: moving, parent_id: discarded }),
	);
	const activeUnder = (await folderRows()).filter((row) => row.parent_id === discarded && row.trashed_at === null);

	// FLD-UPD-14.1
	expect({ code: move.code, trashed: (await folderRow(discarded)).trashed_at !== null }).toEqual({
		code: null,
		trashed: true,
	});
	// FLD-UPD-14.2
	expect(activeUnder).toEqual([]);
});

it("FLD-UPD-15 같은 폴더의 이름과 부모를 동시에 각각 바꿔도 두 변경이 모두 남는다", async () => {
	const [target, parent] = [await seedFolder({ name: "Target" }), await seedFolder({ name: "Parent" })];
	const monti = montiOf();

	// 이름 수정을 커밋 직전에 멈춰 두고 부모 수정을 시작한다.
	const [rename, move] = await overlap(
		db,
		(hold) =>
			monti.transaction(async (tx) => {
				const renamed = await tx.folders.update({ id: target, name: "Renamed" });
				await hold();
				return renamed;
			}),
		() => monti.folders.update({ id: target, parent_id: parent }),
	);
	const row = await folderRow(target);

	// FLD-UPD-15.1
	expect([rename.code, move.code]).toEqual([null, null]);
	// FLD-UPD-15.2
	expect({ name: row.name, parent_id: row.parent_id }).toEqual({ name: "Renamed", parent_id: parent });
});
