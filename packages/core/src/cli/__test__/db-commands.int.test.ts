import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "../../testing";
import { dbMigrate, dbSetup } from "../db";
import { runCli } from "../index";
import { project, setEnv } from "./doctor-helpers";

const DATABASE = process.env.CMS_TEST_DATABASE_URL ?? "";

describe("monti db:setup and monti db:migrate", () => {
	let pool: Pool;
	let base: string;
	const extraSchemas: string[] = [];

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		base = isolated.schemaName;
	});

	afterEach(() => vi.restoreAllMocks());

	afterAll(async () => {
		for (const schema of extraSchemas) await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
		if (pool && base) await dropIsolatedTestPool(pool, base);
		await closeGlobalPool();
	});

	/** A schema name that does not exist yet (the commands create it), dropped when the tests are done. */
	const freshSchema = (name: string) => {
		const schema = `${base}_${name}`;
		extraSchemas.push(schema);
		return schema;
	};

	const tablesIn = async (schema: string) =>
		(
			await pool.query<{ table_name: string }>(
				"SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY 1",
				[schema],
			)
		).rows.map((row) => row.table_name);

	const run = async (command: typeof dbSetup | typeof dbMigrate, schema: string) => {
		setEnv({ DATABASE_URL: DATABASE, DATABASE_SCHEMA: schema });
		const lines: string[] = [];
		const code = await command({
			cwd: project(),
			envFiles: [],
			log: (line) => lines.push(line),
			error: (line) => lines.push(line),
		}).catch((error: unknown) => {
			lines.push(String(error instanceof Error ? error.message : error));
			return 1;
		});
		return { code, lines, text: lines.join("\n") };
	};

	it("setup on an empty database creates the schema and the tables, and says where and how many", async () => {
		const schema = freshSchema("setup");
		const result = await run(dbSetup, schema);
		expect(result.code).toBe(0);
		const tables = await tablesIn(schema);
		expect(tables).toContain("cms_migrations");
		expect(result.lines[0]).toMatch(/^Creating Monti's tables in /);
		const target = new URL(DATABASE);
		expect(result.lines[0]).toContain(target.hostname);
		expect(result.lines[0]).toContain(target.pathname.slice(1));
		expect(result.lines[0]).toContain(`schema "${schema}"`);
		expect(result.lines.at(-1)).toBe(`Done: created ${tables.length} tables.`);
		// First-time setup is one plain story: no per-plugin "migrating" line, the plugin tables are in the count.
		expect(result.text).not.toMatch(/migrat/i);
		// No credentials are printed: take away what is meant to be shown and neither the user nor the password is left.
		const allowed = [target.hostname, target.port, target.pathname.slice(1), schema, "postgres"].filter(Boolean);
		const rest = allowed.reduce((text, part) => text.split(part).join(""), result.text);
		for (const secret of [target.username, target.password].map(decodeURIComponent).filter(Boolean)) {
			if (!allowed.includes(secret)) expect(rest).not.toContain(secret);
		}
		expect(result.text).not.toMatch(/@/);
	});

	it("setup on a database that is already set up changes nothing and points to db:migrate", async () => {
		const schema = freshSchema("again");
		await run(dbSetup, schema);
		const before = await tablesIn(schema);
		const applied = (await pool.query(`SELECT name FROM "${schema}".cms_migrations ORDER BY name`)).rows;

		const again = await run(dbSetup, schema);
		expect(again.code).toBe(0);
		expect(again.text).toBe(
			`Monti is already set up in this database (schema "${schema}"). After updating Monti, run \`monti db:migrate\`.`,
		);
		expect(await tablesIn(schema)).toEqual(before);
		expect((await pool.query(`SELECT name FROM "${schema}".cms_migrations ORDER BY name`)).rows).toEqual(applied);
	});

	it("setup in a schema that has only other tables adds Monti's own, says so, and leaves the others alone", async () => {
		const schema = freshSchema("shared");
		await pool.query(`CREATE SCHEMA "${schema}"`);
		await pool.query(`CREATE TABLE "${schema}".orders (id int PRIMARY KEY)`);
		await pool.query(`INSERT INTO "${schema}".orders VALUES (1)`);

		const result = await run(dbSetup, schema);
		expect(result.code).toBe(0);
		expect(result.text).toContain("already has 1 other table");
		expect(await tablesIn(schema)).toContain("orders");
		const monti = (await tablesIn(schema)).length - 1;
		expect(result.lines.at(-1)).toBe(`Done: created ${monti} tables.`);
		expect((await pool.query(`SELECT id FROM "${schema}".orders`)).rows).toEqual([{ id: 1 }]);
	});

	it("migrate on a database that was never set up points to db:setup, fails, and creates nothing", async () => {
		const schema = freshSchema("never");
		const result = await run(dbMigrate, schema);
		expect(result.code).toBe(1);
		expect(result.text).toContain("monti db:setup");
		expect(await tablesIn(schema)).toEqual([]);
	});

	it("migrate says it is up to date when no step is pending", async () => {
		const schema = freshSchema("update");
		await run(dbSetup, schema);

		const none = await run(dbMigrate, schema);
		expect(none.code).toBe(0);
		expect(none.lines[0]).toBe("Bringing Monti's tables up to date with this version…");
		expect(none.lines.at(-1)).toBe("Already up to date.");
		expect(none.text).not.toContain("monti db:setup");
	});

	it("migrate refuses a database created by an older pre-release, and says to recreate it", async () => {
		const schema = freshSchema("outdated");
		await run(dbSetup, schema);
		await pool.query(`INSERT INTO "${schema}".cms_migrations (name) VALUES ('0017_unparsed_bodies')`);

		const refused = await run(dbMigrate, schema);

		expect(refused.code).toBe(1);
		expect(refused.text).toContain("cannot be upgraded");
	});

	it("the command line returns 0 for both, and 1 for migrate before setup", async () => {
		const schema = freshSchema("cli");
		setEnv({ DATABASE_URL: DATABASE, DATABASE_SCHEMA: schema });
		const io = (cwd: string) => ({ cwd, log: () => undefined, error: () => undefined });
		const cwd = project();
		expect(await runCli(["db:migrate", "--no-env-file"], io(cwd))).toBe(1);
		expect(await runCli(["db:setup", "--no-env-file"], io(cwd))).toBe(0);
		expect(await runCli(["db:setup", "--no-env-file"], io(cwd))).toBe(0);
		expect(await runCli(["db:migrate", "--no-env-file"], io(cwd))).toBe(0);
		// The old command is gone, with no alias.
		expect(await runCli(["migrate"], io(cwd))).toBe(1);
	});
});
