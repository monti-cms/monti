import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { createTestDatabase, recordedMigrations, type TestDatabase, tableExists } from "./__test__/database";
import { initial } from "./db/migrations/0001-initial";
import type { Database } from "./db/types";
import { defineWrite } from "./engine/operation";
import type { MontiConfig, Plugin, Schema } from "./engine/types";
import { startMonti } from "./index";

let testDb: TestDatabase;
let db: Kysely<Database>;
let dir: string;
let schemaFile: string;
let configFile: string;

const schema: Schema = { locales: ["ko"], collections: { posts: { fields: { title: { type: "text" } } } } };

/** 8종 밖의 `type`을 가진 필드가 있는 스키마: 타입 없이 부르는 쪽이 보내는 그대로. */
const unknownType: Schema = JSON.parse(
	JSON.stringify({ locales: ["ko"], collections: { posts: { fields: { title: { type: "richtext" } } } } }),
);

beforeEach(async () => {
	testDb = await createTestDatabase();
	db = testDb.db as Kysely<Database>;
	dir = await mkdtemp(path.join(tmpdir(), "monti-start-"));
	schemaFile = path.join(dir, "monti.schema.ts");
	configFile = path.join(dir, "monti.config.ts");
	await writeFile(schemaFile, `export default ${JSON.stringify(schema)};\n`);
	await writeFile(configFile, `export default { name: "Monti Blog" };\n`);
});

afterEach(async () => {
	await testDb.drop();
	await rm(dir, { recursive: true });
});

function start(plugins: Plugin[], startSchema: Schema = schema, config: Partial<MontiConfig> = {}) {
	return startMonti({
		db,
		schema: startSchema,
		config: { name: "Monti Blog", plugins, ...config },
		schemaFile,
		configFile,
	});
}

/** 코어 테이블을 가리키는 플러그인 테이블: 코어 마이그레이션 뒤에만 만들 수 있다. */
async function createPhotos(pluginDb: Kysely<unknown>): Promise<void> {
	await pluginDb.schema
		.createTable("albums_photos")
		.addColumn("id", "uuid", (column) => column.primaryKey())
		.addColumn("folder_id", "uuid", (column) => column.references("folders.id"))
		.execute();
}

async function tagRun(input: { name: string }): Promise<{ tag: string }> {
	return { tag: input.name };
}

it("START-1 시작하면 코어와 플러그인의 마이그레이션을 코어 먼저 실행한다", async () => {
	const plugin: Plugin = { name: "albums", migrations: [{ name: "photos", up: createPhotos }] };

	await start([plugin]);

	// START-1.1
	expect(await recordedMigrations(testDb.db)).toEqual([
		["albums", "photos"],
		["core", initial.name],
	]);
	// START-1.2
	expect(await tableExists(testDb.db, "albums_photos")).toBe(true);
});

it("START-2 `monti` 객체로 코어 리소스와 플러그인 Operation을 모두 실행할 수 있다", async () => {
	const tag = defineWrite({ input: z.object({ name: z.string() }), run: tagRun });
	const plugin: Plugin = { name: "albums", operations: { albums: { tag } } };

	const monti = await start([plugin]);
	const folder = await monti.folders.create({ scope: "media", name: "Photos" });
	// 플러그인 Operation은 `monti`의 타입에 없으므로 이름으로 꺼낸다.
	const albums: { tag: (input: { name: string }) => Promise<{ tag: string }> } = Reflect.get(monti, "albums");
	const output = await albums.tag({ name: "Summer" });

	// START-2.1
	expect(await db.selectFrom("folders").select(["id", "name"]).execute()).toEqual([{ id: folder.id, name: "Photos" }]);
	// START-2.2
	expect(output).toEqual({ tag: "Summer" });
});

it("START-3 스키마에 지원하지 않는 필드 종류가 들어 있으면 마이그레이션 전에 시작을 거절한다", async () => {
	const started = start([], unknownType);

	// START-3.1
	await expect(started).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// START-3.2
	expect(await tableExists(testDb.db, "migrations")).toBe(false);
});

it("START-4 플러그인의 키 서비스가 `keys.check`에 연결된다", async () => {
	const check = vi.fn<(secret: string) => Promise<void>>().mockResolvedValue(undefined);
	const plugin: Plugin = { name: "mail", keyServices: [{ service: "mail", check }] };

	const monti = await start([plugin]);
	await monti.keys.check({ service: "mail", secret: "mail-secret-1234" });

	// START-4.1
	expect(check).toHaveBeenCalledExactlyOnceWith("mail-secret-1234");
});

it("START-5 `monti` 객체의 명세에 코어의 모든 Operation이 들어 있다", async () => {
	const monti = await start([]);

	const names = monti.spec().map((entry) => entry.name);

	// START-5.1
	expect(names.sort()).toEqual(
		[
			"entries.list",
			"entries.get",
			"entries.create",
			"entries.update",
			"entries.publish",
			"entries.unpublish",
			"entries.duplicate",
			"entries.replaceReferences",
			"entries.addLocale",
			"entries.removeLocale",
			"entries.setSourceLocale",
			"translationStatus.list",
			"translationStatus.get",
			"translationStatus.update",
			"templates.list",
			"templates.get",
			"templates.create",
			"templates.update",
			"templates.delete",
			"folders.list",
			"folders.create",
			"folders.update",
			"media.list",
			"media.get",
			"media.create",
			"media.update",
			"media.startUpload",
			"trash.list",
			"trash.get",
			"trash.delete",
			"trash.move",
			"trash.restore",
			"schema.get",
			"schema.update",
			"config.get",
			"config.update",
			"keys.list",
			"keys.create",
			"keys.update",
			"keys.delete",
			"keys.check",
			"session.get",
			"session.create",
			"session.delete",
			"admin.create",
			"admin.update",
		].sort(),
	);
});

it("START-6 개발 서버로 시작하면 스키마에 정의된 컬렉션 테이블을 DB에 준비한다", async () => {
	await start([], schema, { dev: true });

	// START-6.1
	expect({ posts: await tableExists(testDb.db, "posts"), data: await tableExists(testDb.db, "posts_data") }).toEqual({
		posts: true,
		data: true,
	});
});
