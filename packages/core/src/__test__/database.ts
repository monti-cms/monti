import { randomUUID } from "node:crypto";
import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";

/**
 * How to reach `database` on the test server. Without `TEST_DATABASE_URL` the driver's defaults pick the server (the
 * `PGHOST`, `PGPORT` and `PGUSER` variables, else the local server as the current user). With it, the URL names the
 * server and its own database, and any other database on it is reached by changing the URL's path.
 */
export function testServer(database?: string): pg.PoolConfig {
	const url = process.env.TEST_DATABASE_URL;
	if (url === undefined) return { database: database ?? "postgres" };
	if (database === undefined) return { connectionString: url };
	const other = new URL(url);
	other.pathname = `/${database}`;
	return { connectionString: other.toString() };
}

export interface TestDatabase {
	db: Kysely<unknown>;
	drop: () => Promise<void>;
}

function connect<DB>(config: pg.PoolConfig): Kysely<DB> {
	return new Kysely<DB>({ dialect: new PostgresDialect({ pool: new pg.Pool({ ...config, max: 4 }) }) });
}

/** Runs `run` with a connection to the server's own database, used to create and drop the test databases. */
async function onServer(run: (server: Kysely<unknown>) => Promise<void>): Promise<void> {
	const server = connect<unknown>(testServer());
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
	const db = connect<unknown>(testServer(name));
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

/** `migrations` 테이블의 행을 `[scope, name]` 쌍으로, 코드 단위 순으로 정렬해 돌려준다. */
export async function recordedMigrations(db: Kysely<unknown>): Promise<[string, string][]> {
	const { rows } = await sql<{ scope: string; name: string }>`
		select scope, name from migrations
	`.execute(db);
	return rows.map((row): [string, string] => [row.scope, row.name]).sort(byCodeUnit);
}

function byCodeUnit([scopeA, nameA]: [string, string], [scopeB, nameB]: [string, string]): number {
	if (scopeA !== scopeB) return scopeA < scopeB ? -1 : 1;
	return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
}
