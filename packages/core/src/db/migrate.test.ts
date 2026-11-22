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

/** 실행되면 `log`에 자기 이름만 적는 마이그레이션. */
function logged(name: string, log: string[]): Migration {
	async function up(): Promise<void> {
		log.push(name);
	}
	return { name, up };
}

/** 받은 DB에 `table`을 만들고 `log`에 자기 이름을 적는 마이그레이션. */
function creating(name: string, table: string, log: string[]): Migration {
	async function up(db: Kysely<unknown>): Promise<void> {
		log.push(name);
		await db.schema.createTable(table).addColumn("id", "integer").execute();
	}
	return { name, up };
}

/** `second_table`을 만든 뒤 오류로 실패하는 마이그레이션. */
function failingAfterCreate(name: string): Migration {
	async function up(db: Kysely<unknown>): Promise<void> {
		await db.schema.createTable("second_table").addColumn("id", "integer").execute();
		throw new Error("두 번째 마이그레이션이 실패한다");
	}
	return { name, up };
}

it("DB-MIG-1 마이그레이션 배열을 순서대로 실행한다", async () => {
	const log: string[] = [];

	await migrate(testDb.db, "core", [logged("second", log), logged("first", log)]);

	// DB-MIG-1.1
	expect(log).toEqual(["second", "first"]);
	// DB-MIG-1.2
	expect(await recordedMigrations(testDb.db)).toEqual([
		["core", "first"],
		["core", "second"],
	]);
});

it("DB-MIG-2 이미 실행된 마이그레이션은 건너뛰고 새 마이그레이션만 실행한다", async () => {
	await migrate(testDb.db, "core", [logged("first", [])]);
	const log: string[] = [];

	await migrate(testDb.db, "core", [logged("first", log), logged("second", log)]);

	// DB-MIG-2.1
	expect(log).toEqual(["second"]);
	// DB-MIG-2.2
	expect(await recordedMigrations(testDb.db)).toEqual([
		["core", "first"],
		["core", "second"],
	]);
});

it("DB-MIG-3 마이그레이션이 중간에 실패하면 해당 마이그레이션을 롤백한다", async () => {
	const log: string[] = [];
	const migrations = [creating("first", "first_table", log), failingAfterCreate("second"), logged("third", log)];

	const run = migrate(testDb.db, "core", migrations);

	// DB-MIG-3.5
	await expect(run).rejects.toThrow("두 번째 마이그레이션이 실패한다");
	const firstState = {
		table: await tableExists(testDb.db, "first_table"),
		recorded: await recordedMigrations(testDb.db),
	};
	// DB-MIG-3.1
	expect(firstState).toEqual({ table: true, recorded: expect.arrayContaining([["core", "first"]]) });
	// DB-MIG-3.2
	expect(await tableExists(testDb.db, "second_table")).toBe(false);
	// DB-MIG-3.3
	expect(await recordedMigrations(testDb.db)).toEqual([["core", "first"]]);
	// DB-MIG-3.4
	expect(log).toEqual(["first"]);
});

it("DB-MIG-4 코어와 플러그인의 마이그레이션 이력을 범위별로 구분해 기록한다", async () => {
	await migrate(testDb.db, "core", [logged("init", [])]);
	const log: string[] = [];

	await migrate(testDb.db, "@monti-cms/ai", [logged("init", log)]);

	// DB-MIG-4.1
	expect(log).toEqual(["init"]);
	// DB-MIG-4.2
	expect(await recordedMigrations(testDb.db)).toEqual([
		["@monti-cms/ai", "init"],
		["core", "init"],
	]);
});

it("DB-SCH-1 첫 마이그레이션이 8개 고정 도메인 테이블을 만든다", async () => {
	await migrate(testDb.db, "core", [initial]);

	// DB-SCH-1.1
	expect(await columnsOf(testDb.db, "templates")).toEqual(["id", "collection", "name", "content"].sort());
	// DB-SCH-1.2
	expect(await columnsOf(testDb.db, "folders")).toEqual(["id", "scope", "parent_id", "name", "trashed_at"].sort());
	// DB-SCH-1.3
	expect(await columnsOf(testDb.db, "media")).toEqual(
		["id", "folder_id", "key", "filename", "mime_type", "size", "width", "height", "trashed_at"].sort(),
	);
	// DB-SCH-1.4
	expect(await columnsOf(testDb.db, "media_uses")).toEqual(
		["media_id", "source_kind", "source_id", "field_path"].sort(),
	);
	// DB-SCH-1.5
	expect(await columnsOf(testDb.db, "loose_files")).toEqual(["key", "remove_after"].sort());
	// DB-SCH-1.6
	expect(await columnsOf(testDb.db, "admin")).toEqual(["id", "email", "password_hash"].sort());
	// DB-SCH-1.7
	expect(await columnsOf(testDb.db, "session")).toEqual(["token_hash", "admin_id", "expires_at"].sort());
	// DB-SCH-1.8
	expect(await columnsOf(testDb.db, "api_keys")).toEqual(["id", "service", "name", "secret", "last4"].sort());
	// DB-SCH-1.9
	expect(await recordedMigrations(testDb.db)).toEqual([["core", "0001-initial"]]);
});
