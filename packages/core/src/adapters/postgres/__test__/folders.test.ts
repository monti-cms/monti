import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CmsError } from "../../../core/store";
import { createContentStore, migrateContentStore } from "../content-store";

// The folder behavior every store has (create, list, move, delete, errors) is in the store contract (`core/store/__test__/contract/folders.contract.ts`).
// What stays here depends on Postgres: a second connection and a trigger that holds updates until the test lets them go.

function expectCmsError(err: unknown, code: string): void {
	expect(err).toBeInstanceOf(CmsError);
	expect((err as CmsError).code).toBe(code);
}

describe("Folders in Postgres", () => {
	const ctx: { pool?: Pool; schema?: string; schemaCreated: boolean } = { schemaCreated: false };
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;

	beforeAll(async () => {
		const url = process.env.CMS_TEST_DATABASE_URL;
		if (!url) {
			throw new Error("CMS_TEST_DATABASE_URL is required — never use CMS_DATABASE_URL for tests.");
		}
		schemaName = `cms_fd_${randomBytes(4).toString("hex")}`;
		pool = new Pool({ connectionString: url });
		ctx.pool = pool;
		ctx.schema = schemaName;
		await pool.query(`CREATE SCHEMA "${schemaName}"`);
		ctx.schemaCreated = true;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
	});

	afterAll(async () => {
		try {
			if (ctx.pool && ctx.schemaCreated && ctx.schema) {
				await ctx.pool.query(`DROP SCHEMA "${ctx.schema}" CASCADE`);
			}
		} finally {
			if (ctx.pool) {
				await ctx.pool.end();
			}
		}
	});

	// -----------------------------------------------------------------------
	// 8  Concurrency opposing moves
	// -----------------------------------------------------------------------

	it("8. Folder concurrency: concurrent opposing moves (A under B, B under A) fulfills one, rejects other with invalid_input, graph is acyclic", async () => {
		const lockId = randomBytes(4).readInt32BE();
		const appName = `test8_${randomBytes(4).toString("hex")}`;
		const funcName = `trig_func_${randomBytes(4).toString("hex")}`;
		const triggerName = `trig_${randomBytes(4).toString("hex")}`;
		const url = process.env.CMS_TEST_DATABASE_URL;
		if (!url) {
			throw new Error("CMS_TEST_DATABASE_URL is required");
		}

		const customPool = new Pool({
			connectionString: url,
			max: 2,
			application_name: appName,
		});
		const customStore = createContentStore(customPool, { schema: schemaName });
		const gateClient = await pool.connect();

		let lockHeld = false;
		let triggerCreated = false;
		let funcCreated = false;

		const fA = await store.createFolder({ collection: "fc8", parentId: null, name: "A" });
		const fB = await store.createFolder({ collection: "fc8", parentId: null, name: "B" });

		let p1: Promise<unknown> | undefined;
		let p2: Promise<unknown> | undefined;

		try {
			await gateClient.query("SELECT pg_advisory_lock($1)", [lockId]);
			lockHeld = true;

			await pool.query(`
				CREATE FUNCTION "${schemaName}"."${funcName}"() RETURNS trigger AS $$
				BEGIN
					PERFORM pg_advisory_lock(${lockId});
					PERFORM pg_advisory_unlock(${lockId});
					RETURN NEW;
				END;
				$$ LANGUAGE plpgsql;
			`);
			funcCreated = true;

			await pool.query(`
				CREATE TRIGGER "${triggerName}" BEFORE UPDATE ON "${schemaName}".folders
				FOR EACH ROW EXECUTE FUNCTION "${schemaName}"."${funcName}"();
			`);
			triggerCreated = true;

			p1 = customStore.updateFolder({ id: fA.id, parentId: fB.id });
			p2 = customStore.updateFolder({ id: fB.id, parentId: fA.id });

			await expect
				.poll(
					async () => {
						const res = await pool.query(
							"SELECT state, wait_event FROM pg_stat_activity WHERE application_name = $1 AND pid <> pg_backend_pid()",
							[appName],
						);
						return res.rows.filter((r) => r.state === "active" && r.wait_event !== null).length;
					},
					{ timeout: 15_000 },
				)
				.toBe(2);

			await gateClient.query("SELECT pg_advisory_unlock($1)", [lockId]);
			lockHeld = false;

			const results = await Promise.allSettled([p1, p2]);

			const fulfilled = results.filter((r) => r.status === "fulfilled");
			const rejected = results.filter((r) => r.status === "rejected");

			expect(fulfilled).toHaveLength(1);
			expect(rejected).toHaveLength(1);

			const err = (rejected[0] as PromiseRejectedResult).reason;
			expectCmsError(err, "invalid_input");

			const folders = await store.listFolders({ collection: "fc8" });
			const map = new Map(folders.map((f) => [f.id, f.parentId]));

			const aParent = map.get(fA.id);
			const bParent = map.get(fB.id);

			expect([aParent, bParent]).toContain(null);
			if (aParent === null) {
				expect(bParent).toBe(fA.id);
			} else {
				expect(aParent).toBe(fB.id);
			}
		} finally {
			if (lockHeld) {
				await gateClient.query("SELECT pg_advisory_unlock($1)", [lockId]).catch(() => {});
			}

			// Await hanging promises to release table locks before dropping trigger
			if (p1 && p2) {
				await Promise.allSettled([p1, p2]);
			}

			if (triggerCreated) {
				await pool.query(`DROP TRIGGER IF EXISTS "${triggerName}" ON "${schemaName}".folders CASCADE`);
			}
			if (funcCreated) {
				await pool.query(`DROP FUNCTION IF EXISTS "${schemaName}"."${funcName}"() CASCADE`);
			}
			gateClient.release();
			await customPool.end();
		}
	}, 30_000);
});
