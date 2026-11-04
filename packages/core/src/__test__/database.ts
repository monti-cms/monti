import { randomBytes } from "node:crypto";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { afterAll } from "vitest";
import { migrateToLatest } from "../db/migrations";
import type { Database } from "../db/schema";

const URL = process.env.CMS_TEST_DATABASE_URL;

/**
 * A fresh schema in the test database (`CMS_TEST_DATABASE_URL`) with the core's tables, dropped when the file's tests end. Each test file gets its
 * own, so files run side by side.
 */
export async function testDatabase<Extra = object>(): Promise<Kysely<Database & Extra>> {
	if (!URL) throw new Error("Set CMS_TEST_DATABASE_URL (postgres://localhost/monti_test) to run the core tests.");
	const schema = `test_${randomBytes(6).toString("hex")}`;
	const admin = new Pool({ connectionString: URL, max: 1 });
	await admin.query(`create schema ${schema}`);
	const db = new Kysely<Database & Extra>({
		dialect: new PostgresDialect({ pool: new Pool({ connectionString: URL, options: `-c search_path=${schema}` }) }),
	});
	await migrateToLatest(db as unknown as Kysely<Database>);
	afterAll(async () => {
		await db.destroy();
		await admin.query(`drop schema ${schema} cascade`);
		await admin.end();
	});
	return db;
}

export { sql };
