import { randomUUID } from "node:crypto";
import type { Database } from "@monti-cms/core";
import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";

/** 테스트 하나만 쓰는 새 빈 PostgreSQL DB. */
export interface TestDatabase {
	/** 이 DB의 연결 문자열. CLI에는 `DATABASE_URL`로 넘긴다. */
	url: string;
	/** 테스트가 DB를 준비하고 확인할 때 쓰는 연결. */
	db: Kysely<Database>;
	/** 연결을 닫고 DB를 지운다. */
	drop: () => Promise<void>;
}

/**
 * 테스트 서버에 있는 `database` DB의 연결 문자열. `TEST_DATABASE_URL`이 있으면 그 URL의 경로(DB 이름)만 바꾸고, 없으면
 * 호스트와 사용자를 비운 URL이라 드라이버 기본값(`PGHOST`·`PGPORT`·`PGUSER`, 없으면 로컬 서버와 현재 사용자)으로 연결한다.
 */
function databaseUrl(database: string): string {
	const url = new URL(process.env.TEST_DATABASE_URL ?? "postgres://");
	url.pathname = `/${database}`;
	return url.href;
}

function connect(url: string): Kysely<Database> {
	return new Kysely<Database>({
		dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: url, max: 4 }) }),
	});
}

/** 테스트 DB를 만들고 지울 때 쓰는 서버 연결(`TEST_DATABASE_URL`의 DB, 없으면 로컬 서버의 `postgres`)로 `run`을 실행한다. */
async function onServer(run: (server: Kysely<Database>) => Promise<unknown>): Promise<void> {
	const server = connect(process.env.TEST_DATABASE_URL ?? databaseUrl("postgres"));
	try {
		await run(server);
	} finally {
		await server.destroy();
	}
}

/** 테스트 하나만 쓰는 새 빈 DB(`monti_cli_test_<uuid>`)를 만든다. */
export async function createTestDatabase(): Promise<TestDatabase> {
	const name = `monti_cli_test_${randomUUID().replaceAll("-", "")}`;
	await onServer((server) => sql`create database ${sql.id(name)} template template0`.execute(server));
	const url = databaseUrl(name);
	const db = connect(url);
	async function drop(): Promise<void> {
		await db.destroy();
		await onServer((server) => sql`drop database if exists ${sql.id(name)} with (force)`.execute(server));
	}
	return { url, db, drop };
}

export async function tableExists(db: Kysely<Database>, table: string): Promise<boolean> {
	const { rows } = await sql<{ found: boolean }>`select to_regclass(${`public.${table}`}) is not null as found`.execute(
		db,
	);
	return rows[0].found;
}

/** 테이블의 열 이름을 코드 단위 순으로. 테이블이 없으면 비어 있다. */
export async function columnsOf(db: Kysely<Database>, table: string): Promise<string[]> {
	const { rows } = await sql<{ column_name: string }>`
		select column_name from information_schema.columns
		where table_schema = 'public' and table_name = ${table}
	`.execute(db);
	return rows.map((row) => row.column_name).sort();
}

/** `migrations` 테이블의 행을 `[source, name]` 쌍으로, 출처와 이름의 코드 단위 순으로 돌려준다. */
export async function recordedMigrations(db: Kysely<Database>): Promise<[string, string][]> {
	const { rows } = await sql<{ source: string; name: string }>`
		select source, name from migrations order by source collate "C", name collate "C"
	`.execute(db);
	return rows.map((row): [string, string] => [row.source, row.name]);
}
