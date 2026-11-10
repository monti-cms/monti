import { randomBytes } from "node:crypto";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { afterAll, describe, expect, inject, it } from "vitest";
import { migrateToLatest } from "./migrations";
import type { Database } from "./schema";

const URL = process.env.CMS_TEST_DATABASE_URL;

describe("migrating while another site changes its tables", () => {
	it("00-6 a site's migration does not fail when another schema in the same database drops a table meanwhile", async () => {
		if (!URL) throw new Error("Set CMS_TEST_DATABASE_URL (postgres://localhost/monti_test) to run the core tests.");
		const admin = new Pool({ connectionString: URL, max: 4 });
		afterAll(() => admin.end());
		const other = `${inject("testRun")}${randomBytes(6).toString("hex")}`;
		await admin.query(`create schema ${other}`);
		// Another site in the same database keeps making and dropping a table, as a schema apply does.
		let churning = true;
		const churn = (async () => {
			while (churning) {
				await admin.query(`create table if not exists ${other}.monti_post (id text)`);
				await admin.query(`drop table if exists ${other}.monti_post`);
			}
		})();
		try {
			for (let round = 0; round < 6; round++) {
				const schema = `${inject("testRun")}${randomBytes(6).toString("hex")}`;
				await admin.query(`create schema ${schema}`);
				const db = new Kysely<Database>({
					dialect: new PostgresDialect({
						pool: new Pool({ connectionString: URL, options: `-c search_path=${schema}` }),
					}),
				});
				try {
					await expect(migrateToLatest(db)).resolves.toBeUndefined();
				} finally {
					await db.destroy();
				}
			}
		} finally {
			churning = false;
			await churn;
		}
	}, 60_000);
});
