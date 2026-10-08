import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { postgres } from "../adapters/postgres/adapter";
import { normalizeConnectionString } from "../adapters/postgres/connection";
import { problemError } from "../core/problem";
import type { CmsServerConfig } from "../server/define";
import { fakeAuth } from "./fake-cms";

/** What {@link testServer} returns: the server options to spread into `defineConfig`, and the cleanup. */
export interface TestServer {
	/** `{ database, auth }`: spread it into `defineConfig({ …, ...server })`. */
	readonly server: Pick<CmsServerConfig, "database" | "auth">;
	/** The name of the schema this test owns. */
	readonly schema: string;
	/** Drops the schema. Call `cms.close()` first. */
	drop(): Promise<void>;
}

/**
 * The server options for a test that runs the real write pipeline: a Postgres adapter on a schema of its own in `CMS_TEST_DATABASE_URL`, and a login where every
 * request is signed in as an admin (so `cms.handle(request)` reaches the admin routes). `cms.migrate()` creates the tables, `drop()` removes the schema, so tests never see each other's data.
 *
 * ```ts
 * const test = testServer();
 * const cms = defineConfig({ schema, plugins: [myPlugin()], ...test.server });
 * beforeAll(() => cms.migrate());
 * afterAll(async () => { await cms.close(); await test.drop(); });
 * ```
 */
export function testServer(): TestServer {
	const connectionString = process.env.CMS_TEST_DATABASE_URL;
	if (!connectionString) {
		throw problemError({
			what: "testServer() has no test database",
			where: "the environment variable CMS_TEST_DATABASE_URL",
			fix: "set it to a Postgres URL for tests (never the production database); each test gets a schema of its own in it and drops it afterwards",
		});
	}
	const schema = `cms_test_${randomBytes(4).toString("hex")}`;
	return {
		schema,
		server: {
			database: postgres({ connectionString, schema }),
			auth: fakeAuth({
				session: async () => ({ user: { id: "test-admin", accountId: "test-admin", name: "Test admin" } }),
			}),
		},
		drop: async () => {
			const pool = new Pool({ connectionString: normalizeConnectionString(connectionString), max: 1 });
			try {
				await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
			} finally {
				await pool.end();
			}
		},
	};
}
