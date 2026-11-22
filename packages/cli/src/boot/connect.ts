import { type Database, startMonti } from "@monti-cms/core";
import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";
import type { LoadedProject } from "../migrate/runner";
import { CliError } from "../parse/error";

/** 부팅이 읽는 환경 변수(`loadEnv`가 합친 것). */
type Env = Record<string, string | undefined>;

/** `withMonti`에 넘기는 것: 불러온 프로젝트와 환경 변수. */
interface MontiOptions {
	project: LoadedProject;
	env: Env;
}

/** `withMonti`가 콜백에 넘기는 것: 조립한 엔진과 그 엔진이 쓰는 DB 연결. */
interface MontiContext {
	monti: ReturnType<typeof startMonti>;
	db: Kysely<Database>;
}

/**
 * `env.DATABASE_URL`의 PostgreSQL에 연결해 `run`을 실행하고, 성공하든 실패하든 연결을 닫는다. `DATABASE_URL`이 없거나
 * 비어 있으면 연결하지 않고 실행 오류다.
 */
export async function withDb<T>(env: Env, run: (db: Kysely<Database>) => Promise<T>): Promise<T> {
	const url = env.DATABASE_URL;
	if (!url) throw new CliError(1, "DATABASE_URL 환경 변수가 없다");
	const pool = new pg.Pool({ connectionString: url });
	const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
	try {
		return await run(db);
	} finally {
		await db.destroy();
		// Kysely는 한 번도 쿼리하지 않은 인스턴스의 풀을 닫지 않는다. 그대로 두면 끝난 뒤의 쿼리가 아무도 닫지 않는 새 연결을
		// 열므로, 그때는 풀을 직접 닫는다.
		if (!pool.ending) await pool.end();
	}
}

/**
 * `withDb`로 연결한 DB와 `project`로 `startMonti`를 불러 엔진을 조립하고 `run`에 넘긴다. 조립은 DB를 건드리지 않으므로
 * 테이블은 `monti migrate up`(`migrateMonti`)으로 미리 준비되어 있어야 한다. `env.MONTI_SECRET`이 있으면 `keys`의 암호화
 * 비밀값으로 넘긴다. 조립이나 `run`이 실패해도 연결을 닫고 그 오류를 그대로 던진다.
 */
export async function withMonti<T>(
	{ project, env }: MontiOptions,
	run: (context: MontiContext) => Promise<T>,
): Promise<T> {
	return withDb(env, async (db) => {
		const secret = env.MONTI_SECRET ? { secret: env.MONTI_SECRET } : {};
		return run({ monti: startMonti({ db, ...project, ...secret }), db });
	});
}

/**
 * 연결한 서버가 스스로 알려 주는 대상 DB: `DB 이름 (주소:포트)`. 연결 문자열을 읽지 않으므로 비밀번호 같은 접속 정보가 섞일
 * 수 없다. Unix 소켓으로 연결해 서버 주소가 없으면(`inet_server_addr()`가 `null`) DB 이름만이다.
 */
export async function describeConnection(db: Kysely<Database>): Promise<string> {
	const { rows } = await sql<{ label: string }>`
		select concat_ws(' ', current_database(), '(' || host(inet_server_addr()) || ':' || inet_server_port() || ')') as label
	`.execute(db);
	return rows[0].label;
}
