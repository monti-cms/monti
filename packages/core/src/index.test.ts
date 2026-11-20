import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { createTestDatabase, recordedMigrations, type TestDatabase, tableExists } from "./__test__/database";
import { initial } from "./db/migrations/0001-initial";
import type { Database } from "./db/types";
import { MontiError } from "./engine/errors";
import { defineWrite } from "./engine/operation";
import type { Monti, Plugin, Schema } from "./engine/types";
import { startMonti } from "./index";

let testDb: TestDatabase;
let db: Kysely<Database>;
let dir: string;
let schemaFile: string;
let configFile: string;

const schema: Schema = { locales: ["ko"], collections: { posts: { fields: { title: { type: "text" } } } } };

/** A schema with a field whose `type` is none of the 8, as an untyped caller would send it. */
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

function start(plugins: Plugin[], startSchema: Schema = schema) {
	return startMonti({ db, schema: startSchema, config: { name: "Monti Blog", plugins }, schemaFile, configFile });
}

/** A plugin table that points at a core table: it can only be created after the core migration. */
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

it("START-1 runs the core migrations first, then the plugin's", async () => {
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

it("START-2 runs core resources and plugin operations through the monti object", async () => {
	const tag = defineWrite({ input: z.object({ name: z.string() }), run: tagRun });
	const plugin: Plugin = { name: "albums", operations: { albums: { tag } } };

	const monti = await start([plugin]);
	const folder = await monti.folders.create({ scope: "media", name: "Photos" });
	const output = await (monti as unknown as Monti<{ albums: { tag: typeof tag } }>).albums.tag({ name: "Summer" });

	// START-2.1
	expect(await db.selectFrom("folders").select(["id", "name"]).execute()).toEqual([{ id: folder.id, name: "Photos" }]);
	// START-2.2
	expect(output).toEqual({ tag: "Summer" });
});

it("START-3 rejects a schema with an undefined field type with BAD_REQUEST before migrating", async () => {
	const started = start([], unknownType);

	// START-3.1
	await expect(started).rejects.toBeInstanceOf(MontiError);
	// START-3.1
	await expect(started).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// START-3.2
	expect(await tableExists(testDb.db, "monti_migrations")).toBe(false);
});

it("START-4 connects a plugin's key services to keys.check", async () => {
	const check = vi.fn<(secret: string) => Promise<void>>().mockResolvedValue(undefined);
	const plugin: Plugin = { name: "mail", keyServices: [{ service: "mail", check }] };

	const monti = await start([plugin]);
	await monti.keys.check({ service: "mail", secret: "mail-secret-1234" });

	// START-4.1
	expect(check).toHaveBeenCalledExactlyOnceWith("mail-secret-1234");
});

it("START-5 lists every core operation in the monti object's spec", async () => {
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
