import { randomUUID } from "node:crypto";
import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";

/** The server the tests create their databases on. Set `TEST_DATABASE_URL` to use another one. */
export const TEST_SERVER_URL = process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/postgres";

export interface TestDatabase {
	db: Kysely<unknown>;
	drop: () => Promise<void>;
}

function connect<DB>(connectionString: string): Kysely<DB> {
	return new Kysely<DB>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max: 4 }) }) });
}

/** Runs `run` with a connection to the server's own database, used to create and drop the test databases. */
async function onServer(run: (server: Kysely<unknown>) => Promise<void>): Promise<void> {
	const server = connect<unknown>(TEST_SERVER_URL);
	try {
		await run(server);
	} finally {
		await server.destroy();
	}
}

/** A new, empty Postgres database of its own for one test. `drop` closes the connection and removes the database. */
export async function createTestDatabase(): Promise<TestDatabase> {
	const name = `monti_core_test_${randomUUID().replaceAll("-", "")}`;
	await onServer(async (server) => {
		await sql`create database ${sql.id(name)} template template0`.execute(server);
	});
	const url = new URL(TEST_SERVER_URL);
	url.pathname = `/${name}`;
	const db = connect<unknown>(url.toString());
	const drop = async () => {
		await db.destroy();
		await onServer(async (server) => {
			await sql`drop database if exists ${sql.id(name)} with (force)`.execute(server);
		});
	};
	return { db, drop };
}

/** The names of a table's columns, sorted by code unit; empty when the table does not exist. */
export async function columnsOf(db: Kysely<unknown>, table: string): Promise<string[]> {
	const { rows } = await sql<{ column_name: string }>`
		select column_name from information_schema.columns
		where table_schema = 'public' and table_name = ${table}
	`.execute(db);
	return rows.map((row) => row.column_name).sort();
}

export async function tableExists(db: Kysely<unknown>, table: string): Promise<boolean> {
	const { rows } = await sql<{ name: string | null }>`select to_regclass(${`public.${table}`})::text as name`.execute(
		db,
	);
	return rows[0]?.name != null;
}

/** The rows of `monti_migrations` as `[scope, name]` pairs, sorted by code unit. */
export async function recordedMigrations(db: Kysely<unknown>): Promise<[string, string][]> {
	const { rows } = await sql<{ scope: string; name: string }>`
		select scope, name from monti_migrations
	`.execute(db);
	return rows.map((row): [string, string] => [row.scope, row.name]).sort(byCodeUnit);
}

function byCodeUnit([scopeA, nameA]: [string, string], [scopeB, nameB]: [string, string]): number {
	if (scopeA !== scopeB) return scopeA < scopeB ? -1 : 1;
	return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
}
