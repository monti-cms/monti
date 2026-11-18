import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
	columnsOf,
	createTestDatabase,
	recordedMigrations,
	type TestDatabase,
	tableExists,
} from "../__test__/database";
import { migrate } from "./migrate";
import { initial } from "./migrations/0001-initial";
import type { Migration } from "./types";

let testDb: TestDatabase;

beforeEach(async () => {
	testDb = await createTestDatabase();
});

afterEach(async () => {
	await testDb.drop();
});

/** A migration that only notes in `log` that it ran. */
function logged(name: string, log: string[]): Migration {
	return {
		name,
		up: async () => {
			log.push(name);
		},
	};
}

/** A migration that creates `table` with the database it is given, and notes in `log` that it ran. */
function creating(name: string, table: string, log: string[]): Migration {
	return {
		name,
		up: async (db: Kysely<unknown>) => {
			log.push(name);
			await db.schema.createTable(table).addColumn("id", "integer").execute();
		},
	};
}

it("DB-1 runs the migrations of an array in its order", async () => {
	const log: string[] = [];

	await migrate(testDb.db, "core", [logged("second", log), logged("first", log)]);

	// DB-1.1
	expect(log).toEqual(["second", "first"]);
	// DB-1.2
	expect(await recordedMigrations(testDb.db)).toEqual([
		["core", "first"],
		["core", "second"],
	]);
});

it("DB-2 skips migrations already run and runs only the new ones", async () => {
	await migrate(testDb.db, "core", [logged("first", [])]);
	const log: string[] = [];

	await migrate(testDb.db, "core", [logged("first", log), logged("second", log)]);

	// DB-2.1
	expect(log).toEqual(["second"]);
	// DB-2.2
	expect(await recordedMigrations(testDb.db)).toEqual([
		["core", "first"],
		["core", "second"],
	]);
});

it("DB-3 rolls back a migration that fails midway", async () => {
	const log: string[] = [];
	const failing: Migration = {
		name: "second",
		up: async (db: Kysely<unknown>) => {
			await db.schema.createTable("second_table").addColumn("id", "integer").execute();
			throw new Error("the second migration fails");
		},
	};

	const run = migrate(testDb.db, "core", [creating("first", "first_table", log), failing, logged("third", log)]);

	// DB-3.5
	await expect(run).rejects.toThrow("the second migration fails");
	// DB-3.1
	expect(await tableExists(testDb.db, "first_table")).toBe(true);
	// DB-3.1
	expect(await recordedMigrations(testDb.db)).toContainEqual(["core", "first"]);
	// DB-3.2
	expect(await tableExists(testDb.db, "second_table")).toBe(false);
	// DB-3.3
	expect(await recordedMigrations(testDb.db)).toEqual([["core", "first"]]);
	// DB-3.4
	expect(log).toEqual(["first"]);
});

it("DB-4 records the history of the core and of a plugin apart by scope", async () => {
	await migrate(testDb.db, "core", [logged("init", [])]);
	const log: string[] = [];

	await migrate(testDb.db, "@monti-cms/ai", [logged("init", log)]);

	// DB-4.1
	expect(log).toEqual(["init"]);
	// DB-4.2
	expect(await recordedMigrations(testDb.db)).toEqual([
		["@monti-cms/ai", "init"],
		["core", "init"],
	]);
});

it("DB-5 creates the ten domain tables in the first migration", async () => {
	await migrate(testDb.db, "core", [initial]);

	// DB-5.1
	expect(await columnsOf(testDb.db, "entries")).toEqual(
		[
			"id",
			"collection",
			"locale",
			"source_entry_id",
			"folder_id",
			"slug",
			"data",
			"translation_seen",
			"trashed_at",
		].sort(),
	);
	// DB-5.2
	expect(await columnsOf(testDb.db, "entry_published")).toEqual(["entry_id", "slug", "data", "published_at"].sort());
	// DB-5.3
	expect(await columnsOf(testDb.db, "templates")).toEqual(["id", "collection", "name", "content"].sort());
	// DB-5.4
	expect(await columnsOf(testDb.db, "folders")).toEqual(["id", "scope", "parent_id", "name", "trashed_at"].sort());
	// DB-5.5
	expect(await columnsOf(testDb.db, "media")).toEqual(
		["id", "folder_id", "key", "mime_type", "metadata", "trashed_at"].sort(),
	);
	// DB-5.6
	expect(await columnsOf(testDb.db, "media_uses")).toEqual(
		["media_id", "source_kind", "source_id", "field_path"].sort(),
	);
	// DB-5.7
	expect(await columnsOf(testDb.db, "loose_files")).toEqual(["key", "remove_after"].sort());
	// DB-5.8
	expect(await columnsOf(testDb.db, "monti_admin")).toEqual(["id", "email", "password_hash"].sort());
	// DB-5.9
	expect(await columnsOf(testDb.db, "monti_session")).toEqual(["token_hash", "admin_id", "expires_at"].sort());
	// DB-5.10
	expect(await columnsOf(testDb.db, "api_keys")).toEqual(["id", "service", "name", "secret", "last4"].sort());
	// DB-5.11
	expect(await recordedMigrations(testDb.db)).toEqual([["core", "0001-initial"]]);
});
