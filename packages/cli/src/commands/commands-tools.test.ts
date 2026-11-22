import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir, userInfo } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { coreMigrations, migrate, snapshotOf } from "@monti-cms/core";
import { sql } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase, tableExists } from "../__test__/database";
import { defaultModule, parseOutput, postsSchema, projectModule, testIo, writeProject } from "../__test__/project";
import { formatGlobalHelp } from "../parse/help";
import { runCli } from "./run";

/** 테스트마다 새로 만드는 빈 임시 디렉터리: CLI를 실행한 작업 디렉터리. */
let cwd: string;
/** 작업 디렉터리의 기본 마이그레이션 폴더. */
let dir: string;
/** DB가 필요한 테스트만 만드는 DB. */
let testDb: TestDatabase | undefined;

beforeEach(async () => {
	cwd = await mkdtemp(path.join(tmpdir(), "monti-cli-"));
	dir = path.join(cwd, "migrations");
});

afterEach(async () => {
	await testDb?.drop();
	testDb = undefined;
	await rm(cwd, { recursive: true, force: true });
});

/** 이 테스트의 DB. 처음 부를 때 만들고, 테스트가 끝나면 지운다. */
async function database(): Promise<TestDatabase> {
	testDb ??= await createTestDatabase();
	return testDb;
}

/** 운영 설정(`dev: false`) `monti.config.ts`. */
const productionConfig = defaultModule({ name: "테스트 사이트", dev: false });

/** 개발 서버 설정(`dev: true`) `monti.config.ts`. */
const devConfig = defaultModule({ name: "테스트 사이트", dev: true });

/** 저장소 어댑터를 쓰는 `monti.config.ts`. 어댑터의 `remove`는 받은 키를 `removedKeys`에 적는다. */
const storageConfig = `export const removedKeys: string[] = [];

async function remove(key: string): Promise<void> {
	removedKeys.push(key);
}

export default { name: "테스트 사이트", storage: { remove } };
`;

/** `posts` 테이블을 만드는 SQL. */
const initSql = "create table posts (id uuid primary key);\n";

/** 코어 `folders(id)`를 참조하는 `posts` 테이블을 만드는 SQL. */
const initWithFolderSql = "create table posts (id uuid primary key, folder_id uuid references folders (id));\n";

/** 문법이 틀린 SQL. */
const badSql = "creat table broken (id integer);\n";

/** `bin.mjs`의 경로. */
const binFile = fileURLToPath(new URL("../bin.mjs", import.meta.url));

/** 마이그레이션 폴더에 `.sql` 파일을 쓴다. */
async function writeSql(name: string, text: string): Promise<void> {
	await mkdir(dir, { recursive: true });
	await writeFile(path.join(dir, name), text);
}

/** 마이그레이션 폴더의 파일 이름. 폴더가 없으면 비어 있다. */
async function migrationFiles(): Promise<string[]> {
	return existsSync(dir) ? readdir(dir) : [];
}

/**
 * `base` 연결 문자열에 비어 있는 호스트·사용자·비밀번호를 채운 URL. 채운 비밀번호는 가짜 값이다: 로컬 서버의 trust 인증은
 * 비밀번호를 보지 않고, 비밀번호가 있는 `TEST_DATABASE_URL`이면 그 비밀번호를 그대로 쓴다.
 */
function withCredentials(base: string): URL {
	const url = new URL(base);
	url.hostname ||= "localhost";
	url.username ||= userInfo().username;
	url.password ||= "fake-pass-5678";
	return url;
}

/** 자식 프로세스의 환경 변수: PATH·HOME·USER와 PostgreSQL 변수(`PG*`)만 이어 받고 `DATABASE_URL`을 둔다. */
function childEnv(databaseUrl: string): NodeJS.ProcessEnv {
	const kept = Object.entries(process.env).filter(
		([name]) => ["PATH", "HOME", "USER"].includes(name) || name.startsWith("PG"),
	);
	return { ...Object.fromEntries(kept), DATABASE_URL: databaseUrl };
}

it("CLI-TLS-1 `migrate generate`는 DB 없이 SQL 파일과 스냅샷을 만들고 결과를 JSON으로 출력한다", async () => {
	await writeProject(cwd);
	const { io, stdout } = testIo(cwd);

	const code = await runCli(["migrate", "generate", "init"], io);

	// CLI-TLS-1.1
	expect(code).toBe(0);
	// CLI-TLS-1.2
	expect(await migrationFiles()).toEqual(expect.arrayContaining(["0001_init.sql", "_snapshot.json"]));
	// CLI-TLS-1.3
	expect(parseOutput(stdout())).toMatchObject({ filename: "0001_init.sql", sql: expect.stringMatching(/\S/) });
});

it("CLI-TLS-2 `migrate generate --dry-run`은 파일을 쓰지 않고 `{ sql }` JSON만 출력한다", async () => {
	await writeProject(cwd);
	const { io, stdout } = testIo(cwd);

	const code = await runCli(["migrate", "generate", "--dry-run"], io);

	// CLI-TLS-2.1
	expect(code).toBe(0);
	// CLI-TLS-2.2
	expect(parseOutput(stdout())).toEqual({ sql: expect.stringMatching(/\S/) });
	// CLI-TLS-2.3
	expect(await migrationFiles()).toEqual([]);
});

it("CLI-TLS-3 스키마 변경이 없을 때 `migrate generate`는 `stdout`에 `null`, `stderr`에 변경 없음 안내를 출력한다", async () => {
	await writeProject(cwd);
	await mkdir(dir);
	await writeFile(path.join(dir, "_snapshot.json"), JSON.stringify(snapshotOf(postsSchema)));
	const { io, stdout, stderr } = testIo(cwd);

	const code = await runCli(["migrate", "generate"], io);

	// CLI-TLS-3.1
	expect(code).toBe(0);
	// CLI-TLS-3.2
	expect(parseOutput(stdout())).toBeNull();
	// CLI-TLS-3.3
	expect(stderr()).toContain("변경 사항이 없다");
});

it("CLI-TLS-4 `migrate up`은 비밀번호를 가린 대상 DB 정보를 `stderr`에 출력하고 미적용 SQL을 적용한다", async () => {
	const { url: base, db } = await database();
	const url = withCredentials(base);
	await writeProject(cwd, { "monti.config.ts": productionConfig });
	await writeSql("0001_init.sql", initSql);
	const { io, stdout, stderr } = testIo(cwd, { env: { DATABASE_URL: url.href } });

	const code = await runCli(["migrate", "up"], io);

	// CLI-TLS-4.1
	expect(code).toBe(0);
	// CLI-TLS-4.2
	expect(stderr()).toContain(`${url.host}${url.pathname}`);
	// CLI-TLS-4.3
	expect(stderr()).not.toContain(url.password);
	// CLI-TLS-4.4
	expect(parseOutput(stdout())).toEqual(["0001_init.sql"]);
	// CLI-TLS-4.5
	expect(await tableExists(db, "posts")).toBe(true);
});

it("CLI-TLS-5 `migrate up --dry-run`은 시험 실행 결과를 JSON으로 출력하되 빈 DB에도 변경을 남기지 않는다", async () => {
	const { url, db } = await database();
	await writeProject(cwd, { "monti.config.ts": productionConfig });
	await writeSql("0001_init.sql", initWithFolderSql);
	const { io, stdout } = testIo(cwd, { env: { DATABASE_URL: url } });

	const code = await runCli(["migrate", "up", "--dry-run"], io);

	// CLI-TLS-5.1
	expect(code).toBe(0);
	// CLI-TLS-5.2
	expect(parseOutput(stdout())).toEqual(["0001_init.sql"]);
	const tables = { posts: await tableExists(db, "posts"), migrations: await tableExists(db, "migrations") };
	// CLI-TLS-5.3
	expect(tables).toEqual({ posts: false, migrations: false });
});

it("CLI-TLS-6 `migrate status`는 `migrations` 테이블을 만들지 않고 파일별 적용 여부를 JSON으로 출력한다", async () => {
	const { url, db } = await database();
	await writeProject(cwd);
	await writeSql("0001_init.sql", initSql);
	const { io, stdout } = testIo(cwd, { env: { DATABASE_URL: url } });

	const code = await runCli(["migrate", "status"], io);

	// CLI-TLS-6.1
	expect(code).toBe(0);
	// CLI-TLS-6.2
	expect(parseOutput(stdout())).toEqual([{ name: "0001_init.sql", applied: false }]);
	// CLI-TLS-6.3
	expect(await tableExists(db, "migrations")).toBe(false);
});

it("CLI-TLS-7 `migrate --help`는 전체 도움말을 `stdout`에 출력한다", async () => {
	const { io, stdout, stderr } = testIo(cwd);

	const code = await runCli(["migrate", "--help"], io);

	// CLI-TLS-7.1
	expect(code).toBe(0);
	// CLI-TLS-7.2
	expect(stdout()).toBe(`${formatGlobalHelp()}\n`);
	// CLI-TLS-7.3
	expect(stderr()).toBe("");
});

it("CLI-TLS-8 개발 서버 설정으로 `migrate up`을 실행하면 거절한다", async () => {
	const { url } = await database();
	await writeProject(cwd, { "monti.config.ts": devConfig });
	await writeSql("0001_init.sql", initSql);
	const { io, stdout, stderr } = testIo(cwd, { env: { DATABASE_URL: url } });

	const code = await runCli(["migrate", "up"], io);

	// CLI-TLS-8.1
	expect(code).toBe(1);
	// CLI-TLS-8.2
	expect(stderr()).toMatch(/\S/);
	// CLI-TLS-8.3
	expect(stdout()).toBe("");
});

it("CLI-TLS-9 `migrate up` 중 일반 SQL 오류가 나면 코어 코드 접두 없이 `stderr`에 출력하고 실행 오류로 끝난다", async () => {
	const { url, db } = await database();
	const dbError = await sql
		.raw(badSql)
		.execute(db)
		.then(
			() => "",
			(error: Error) => error.message,
		);
	await writeProject(cwd, { "monti.config.ts": productionConfig });
	await writeSql("0001_bad.sql", badSql);
	const { io, stdout, stderr } = testIo(cwd, { env: { DATABASE_URL: url } });

	const code = await runCli(["migrate", "up"], io);

	// CLI-TLS-9.1
	expect(code).toBe(1);
	// CLI-TLS-9.2
	expect(stderr().split("\n")).toContain(dbError);
	// CLI-TLS-9.3
	expect(stdout()).toBe("");
});

it("CLI-TLS-10 `clean-files`는 만료된 임시 파일을 저장소와 DB에서 제거하고 `stdout`에 `null`을 출력한다", async () => {
	const { url, db } = await database();
	await migrate(db, "@monti-cms/core", coreMigrations);
	await db
		.insertInto("loose_files")
		.values({ key: "uploads/expired.png", remove_after: new Date(Date.now() - 60_000) })
		.execute();
	await writeProject(cwd, { "monti.config.ts": storageConfig });
	const { io, stdout } = testIo(cwd, { env: { DATABASE_URL: url } });

	const code = await runCli(["clean-files"], io);

	const { removedKeys } = await projectModule(cwd, "monti.config.ts");
	const rows = await db.selectFrom("loose_files").select("key").execute();
	// CLI-TLS-10.1
	expect(code).toBe(0);
	// CLI-TLS-10.2
	expect(parseOutput(stdout())).toBeNull();
	// CLI-TLS-10.3
	expect({ removedKeys, rows }).toEqual({ removedKeys: ["uploads/expired.png"], rows: [] });
});

it("CLI-TLS-11 `storage`가 설정되지 않았으면 `clean-files`를 거절한다", async () => {
	const { url } = await database();
	await writeProject(cwd);
	const { io, stdout, stderr } = testIo(cwd, { env: { DATABASE_URL: url } });

	const code = await runCli(["clean-files"], io);

	// CLI-TLS-11.1
	expect(code).toBe(1);
	// CLI-TLS-11.2
	expect(stderr()).toMatch(/\S/);
	// CLI-TLS-11.3
	expect(stdout()).toBe("");
});

it("CLI-TLS-12 `--dry-run`을 지원하지 않는 `clean-files`에 `--dry-run`을 붙이면 DB를 열지 않고 사용법 오류로 거절한다", async () => {
	await writeProject(cwd);
	const { io, stdout, stderr } = testIo(cwd);

	const code = await runCli(["clean-files", "--dry-run"], io);

	// CLI-TLS-12.1
	expect(code).toBe(2);
	// CLI-TLS-12.2
	expect(stderr()).toMatch(/\S/);
	// CLI-TLS-12.3
	expect(stdout()).toBe("");
});

it("CLI-TLS-13 `bin.mjs`는 표준 입력(`--input -`)으로 전달된 JSON을 읽어 명령을 실행하고 결과를 `stdout`에 출력한다", async () => {
	const { url } = await database();
	await writeProject(cwd, {
		"shared.ts": 'export const siteName = "파이프 사이트";\n',
		"monti.config.ts": 'import { siteName } from "./shared";\n\nexport default { name: siteName };\n',
		"monti.schema.ts": `import { siteName } from "./shared";

export default {
	locales: ["ko"],
	collections: { posts: { label: siteName + " 글", fields: { title: { type: "text" } } } },
};
`,
	});

	const child = spawnSync(process.execPath, [binFile, "folders", "create", "--input", "-"], {
		cwd,
		env: childEnv(url),
		input: '{"scope":"posts","name":"파이프"}',
		encoding: "utf8",
	});

	// CLI-TLS-13.1
	expect(child.status).toBe(0);
	// CLI-TLS-13.2
	expect(parseOutput(child.stdout)).toMatchObject({ name: "파이프" });
	// CLI-TLS-13.3
	expect(child.stderr).toBe("");
}, 30_000);
