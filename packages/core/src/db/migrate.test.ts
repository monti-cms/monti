import { randomUUID } from "node:crypto";
import { type Kysely, sql } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
	columnsOf,
	createTestDatabase,
	recordedMigrations,
	type TestDatabase,
	tableExists,
} from "../__test__/database";
import { overlap } from "../__test__/race";
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

	await migrate(testDb.db, "@monti-cms/core", [logged("second", log), logged("first", log)]);

	// DB-MIG-1.1
	expect(log).toEqual(["second", "first"]);
	// DB-MIG-1.2
	expect(await recordedMigrations(testDb.db)).toEqual([
		["@monti-cms/core", "first"],
		["@monti-cms/core", "second"],
	]);
});

it("DB-MIG-2 이미 실행된 마이그레이션은 건너뛰고 새 마이그레이션만 실행한다", async () => {
	await migrate(testDb.db, "@monti-cms/core", [logged("first", [])]);
	const log: string[] = [];

	await migrate(testDb.db, "@monti-cms/core", [logged("first", log), logged("second", log)]);

	// DB-MIG-2.1
	expect(log).toEqual(["second"]);
	// DB-MIG-2.2
	expect(await recordedMigrations(testDb.db)).toEqual([
		["@monti-cms/core", "first"],
		["@monti-cms/core", "second"],
	]);
});

it("DB-MIG-3 마이그레이션이 중간에 실패하면 해당 마이그레이션을 롤백한다", async () => {
	const log: string[] = [];
	const migrations = [creating("first", "first_table", log), failingAfterCreate("second"), logged("third", log)];

	const run = migrate(testDb.db, "@monti-cms/core", migrations);

	// DB-MIG-3.5
	await expect(run).rejects.toThrow("두 번째 마이그레이션이 실패한다");
	const firstState = {
		table: await tableExists(testDb.db, "first_table"),
		recorded: await recordedMigrations(testDb.db),
	};
	// DB-MIG-3.1
	expect(firstState).toEqual({ table: true, recorded: expect.arrayContaining([["@monti-cms/core", "first"]]) });
	// DB-MIG-3.2
	expect(await tableExists(testDb.db, "second_table")).toBe(false);
	// DB-MIG-3.3
	expect(await recordedMigrations(testDb.db)).toEqual([["@monti-cms/core", "first"]]);
	// DB-MIG-3.4
	expect(log).toEqual(["first"]);
});

it("DB-MIG-4 코어와 플러그인의 마이그레이션 이력을 출처별로 구분해 기록한다", async () => {
	await migrate(testDb.db, "@monti-cms/core", [logged("init", [])]);
	const log: string[] = [];

	await migrate(testDb.db, "@monti-cms/ai", [logged("init", log)]);

	// DB-MIG-4.1
	expect(log).toEqual(["init"]);
	// DB-MIG-4.2
	expect(await recordedMigrations(testDb.db)).toEqual([
		["@monti-cms/ai", "init"],
		["@monti-cms/core", "init"],
	]);
});

it("DB-SCH-1 첫 마이그레이션이 8개 고정 도메인 테이블을 만든다", async () => {
	await migrate(testDb.db, "@monti-cms/core", [initial]);

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
	expect(await recordedMigrations(testDb.db)).toEqual([["@monti-cms/core", "0001-initial"]]);
});

/** 실행될 때마다 `counts`에 자기 이름의 횟수를 하나 올리고 `table`을 만드는 마이그레이션. */
function counting(name: string, table: string, counts: Map<string, number>): Migration {
	async function up(db: Kysely<unknown>): Promise<void> {
		counts.set(name, (counts.get(name) ?? 0) + 1);
		await db.schema.createTable(table).addColumn("id", "integer").execute();
	}
	return { name, up };
}

it("DB-MIG-5 같은 DB에 마이그레이션을 동시에 두 번 실행해도 각 단계는 한 번만 실행되고 둘 다 성공한다", async () => {
	const counts = new Map<string, number>();
	const [first, second] = [counting("first", "first_table", counts), counting("second", "second_table", counts)];

	// 첫 실행을 첫 단계 안에서 멈춰 두고 두 번째 실행을 시작한다.
	const runs = await overlap(
		testDb.db,
		(hold) => {
			async function up(db: Kysely<unknown>): Promise<void> {
				await hold();
				await first.up(db);
			}
			return migrate(testDb.db, "@monti-cms/core", [{ name: first.name, up }, second]);
		},
		() => migrate(testDb.db, "@monti-cms/core", [first, second]),
	);

	// DB-MIG-5.1
	expect(runs.map((run) => run.code)).toEqual([null, null]);
	// DB-MIG-5.2
	expect(Object.fromEntries(counts)).toEqual({ first: 1, second: 1 });
	// DB-MIG-5.3
	expect(await recordedMigrations(testDb.db)).toEqual([
		["@monti-cms/core", "first"],
		["@monti-cms/core", "second"],
	]);
});

it("DB-MIG-6 이름이 같은 마이그레이션 단계가 중복으로 들어 있으면 실행할 수 없다", async () => {
	await migrate(testDb.db, "@monti-cms/core", []);
	const log: string[] = [];

	const run = migrate(testDb.db, "@monti-cms/core", [logged("same", log), logged("same", log)]);

	// DB-MIG-6.1
	await expect(run).rejects.toThrow();
	// DB-MIG-6.2
	expect(log).toEqual([]);
	// DB-MIG-6.3
	expect(await recordedMigrations(testDb.db)).toEqual([]);
});

it("DB-SCH-2 같은 글이나 템플릿의 같은 위치에 같은 미디어 사용 기록을 두 번 남길 수 없다", async () => {
	await migrate(testDb.db, "@monti-cms/core", [initial]);
	const [media, source] = [randomUUID(), randomUUID()];
	await sql`insert into media (id, key, filename, mime_type, size) values (${media}, ${media}, 'a.png', 'image/png', 1)`.execute(
		testDb.db,
	);
	const insertUse = sql`insert into media_uses (media_id, source_kind, source_id, field_path)
		values (${media}, 'entry', ${source}, 'cover')`;
	await insertUse.execute(testDb.db);

	const duplicate = insertUse.execute(testDb.db);

	// DB-SCH-2.1
	await expect(duplicate).rejects.toMatchObject({ code: "23505" });
	const { rows } = await sql<{ count: string }>`select count(*) as count from media_uses`.execute(testDb.db);
	// DB-SCH-2.2
	expect(rows).toEqual([{ count: "1" }]);
});
