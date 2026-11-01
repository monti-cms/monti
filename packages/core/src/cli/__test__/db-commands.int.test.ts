import { randomBytes } from "node:crypto";
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
	const extraRoles: string[] = [];

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		base = isolated.schemaName;
	});

	afterEach(() => vi.restoreAllMocks());

	afterAll(async () => {
		for (const schema of extraSchemas) await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
		for (const role of extraRoles) {
			await pool.query(`DROP OWNED BY "${role}"`);
			await pool.query(`DROP ROLE "${role}"`);
		}
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

	const run = async (command: typeof dbSetup | typeof dbMigrate, schema: string, url = DATABASE) => {
		setEnv({ DATABASE_URL: url, DATABASE_SCHEMA: schema });
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

	it("DB-M1 setup on an empty database creates the schema and the tables, and says where and how many", async () => {
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
		// The last line says how many tables were made.
		expect(result.lines.at(-1)).toMatch(new RegExp(`\\b${tables.length} tables\\b`));
		// First-time setup is one plain story: no per-plugin "migrating" line, the plugin tables are in the count.
		expect(result.text).not.toMatch(/migrat/i);
	});

	it("DB-M1 setup on a database that is already set up changes nothing and points to db:migrate", async () => {
		const schema = freshSchema("again");
		await run(dbSetup, schema);
		const before = await tablesIn(schema);
		const applied = (await pool.query(`SELECT name FROM "${schema}".cms_migrations ORDER BY name`)).rows;

		const again = await run(dbSetup, schema);
		expect(again.code).toBe(0);
		// One line: it is already set up, in which schema, and the command for after an update.
		expect(again.lines).toHaveLength(1);
		expect(again.text).toContain("already set up");
		expect(again.text).toContain(`schema "${schema}"`);
		expect(again.text).toContain("monti db:migrate");
		expect(await tablesIn(schema)).toEqual(before);
		expect((await pool.query(`SELECT name FROM "${schema}".cms_migrations ORDER BY name`)).rows).toEqual(applied);
	});

	it("DB-M1 setup in a schema that has only other tables adds Monti's own, says so, and leaves the others alone", async () => {
		const schema = freshSchema("shared");
		await pool.query(`CREATE SCHEMA "${schema}"`);
		await pool.query(`CREATE TABLE "${schema}".orders (id int PRIMARY KEY)`);
		await pool.query(`INSERT INTO "${schema}".orders VALUES (1)`);

		const result = await run(dbSetup, schema);
		expect(result.code).toBe(0);
		expect(result.text).toContain("already has 1 other table");
		expect(await tablesIn(schema)).toContain("orders");
		const monti = (await tablesIn(schema)).length - 1;
		expect(result.lines.at(-1)).toMatch(new RegExp(`\\b${monti} tables\\b`));
		expect((await pool.query(`SELECT id FROM "${schema}".orders`)).rows).toEqual([{ id: 1 }]);
	});

	it("CLI-P2 setup and migrate name the host, the database and the schema, and never the user or the password", async () => {
		// A user and a password of their own, so neither can be mistaken for the host, the database or the schema.
		const suffix = randomBytes(4).toString("hex");
		const user = `monti_user_${suffix}`;
		const password = `pass-${suffix}-word`;
		const target = new URL(DATABASE);
		const database = target.pathname.slice(1);
		await pool.query(`CREATE ROLE "${user}" LOGIN PASSWORD '${password}'`);
		extraRoles.push(user);
		await pool.query(`GRANT CREATE ON DATABASE "${database}" TO "${user}"`);
		const url = new URL(DATABASE);
		url.username = user;
		url.password = password;

		const schema = freshSchema("where");
		for (const command of [dbSetup, dbMigrate]) {
			const result = await run(command, schema, url.href);
			expect(result.code, result.text).toBe(0);
			expect(result.text).toContain(target.hostname);
			expect(result.text).toContain(database);
			expect(result.text).toContain(`schema "${schema}"`);
			expect(result.text).not.toContain(user);
			expect(result.text).not.toContain(password);
		}
	});

	it("DB-M2 migrate on a database that was never set up points to db:setup, fails, and creates nothing", async () => {
		const schema = freshSchema("never");
		const result = await run(dbMigrate, schema);
		expect(result.code).toBe(1);
		expect(result.text).toContain("monti db:setup");
		expect(await tablesIn(schema)).toEqual([]);
	});

	it("DB-M2 the command line returns 0 for both, and 1 for migrate before setup", async () => {
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
