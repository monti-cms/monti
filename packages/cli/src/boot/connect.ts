import { type Database, startMonti } from "@monti-cms/core";
import { Kysely, PostgresDialect } from "kysely";
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

/** `withMonti`가 콜백에 넘기는 것: 시작한 엔진과 그 엔진이 쓰는 DB 연결. */
interface MontiContext {
	monti: Awaited<ReturnType<typeof startMonti>>;
	db: Kysely<Database>;
}

/**
 * `env.DATABASE_URL`의 PostgreSQL에 연결해 `run`을 실행하고, 성공하든 실패하든 연결을 닫는다. `DATABASE_URL`이 없거나
 * 비어 있으면 연결하지 않고 실행 오류다.
 */
export async function withDb<T>(env: Env, run: (db: Kysely<Database>) => Promise<T>): Promise<T> {
	const url = env.DATABASE_URL;
	if (!url) throw new CliError(1, "DATABASE_URL 환경 변수가 없다");
	const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: url }) }) });
	try {
		return await run(db);
	} finally {
		await db.destroy();
	}
}

/**
 * `withDb`로 연결한 DB와 `project`로 `startMonti`를 불러 엔진을 시작하고 `run`에 넘긴다. `env.MONTI_SECRET`이 있으면
 * `keys`의 암호화 비밀값으로 넘긴다. 시작이나 `run`이 실패해도 연결을 닫고 그 오류를 그대로 던진다.
 */
export async function withMonti<T>(
	{ project, env }: MontiOptions,
	run: (context: MontiContext) => Promise<T>,
): Promise<T> {
	return withDb(env, async (db) => {
		const secret = env.MONTI_SECRET ? { secret: env.MONTI_SECRET } : {};
		const monti = await startMonti({ db, ...project, ...secret });
		return run({ monti, db });
	});
}
