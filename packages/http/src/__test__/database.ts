import { randomUUID } from "node:crypto";
import type { Database } from "@monti-cms/core";
import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";

/** 테스트 하나만 쓰는 새 빈 PostgreSQL DB. */
export interface TestDatabase {
	/** 테스트가 `startMonti`에 넘기고 DB를 확인할 때 쓰는 연결. */
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

/** 테스트 하나만 쓰는 새 빈 DB(`monti_http_test_<uuid>`)를 만든다. */
export async function createTestDatabase(): Promise<TestDatabase> {
	const name = `monti_http_test_${randomUUID().replaceAll("-", "")}`;
	await onServer((server) => sql`create database ${sql.id(name)} template template0`.execute(server));
	const db = connect(databaseUrl(name));
	async function drop(): Promise<void> {
		await db.destroy();
		await onServer((server) => sql`drop database if exists ${sql.id(name)} with (force)`.execute(server));
	}
	return { db, drop };
}
