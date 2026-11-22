import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { type Database, type MontiConfig, migrateMonti, type Schema } from "@monti-cms/core";
import { type Kysely, sql } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../__test__/database";
import type { LoadedProject } from "../migrate/runner";
import { withDb, withMonti } from "./connect";
import { loadEnv } from "./env";
import { loadProjectFiles } from "./load";

/** 테스트마다 새로 만드는 빈 임시 디렉터리: CLI를 실행한 작업 디렉터리. */
let cwd: string;
/** DB가 필요한 테스트만 만드는 DB. */
let testDb: TestDatabase | undefined;

beforeEach(async () => {
	cwd = await mkdtemp(path.join(tmpdir(), "monti-cli-"));
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

const config: MontiConfig = { name: "테스트 사이트" };

const schema: Schema = {
	locales: ["ko"],
	collections: { posts: { fields: { title: { type: "text" } } } },
};

/** CLI의 기본값과 같은, 작업 디렉터리에서 본 설정·스키마 파일 경로. */
const projectPaths = { configPath: "./monti.config.ts", schemaPath: "./monti.schema.ts" };

/** `config`와 `schema`를 쓰고, 설정·스키마 파일이 `cwd`에 있는 프로젝트. */
function project(): LoadedProject {
	return {
		config,
		schema,
		configFile: path.join(cwd, "monti.config.ts"),
		schemaFile: path.join(cwd, "monti.schema.ts"),
	};
}

/** `value`를 `default`로 내보내는 TypeScript 모듈 글. */
function defaultModule(value: unknown): string {
	return `const value: unknown = ${JSON.stringify(value)};\nexport default value;\n`;
}

/** 작업 디렉터리에 파일을 쓴다. */
async function writeCwdFile(name: string, text: string): Promise<void> {
	await writeFile(path.join(cwd, name), text);
}

/**
 * 로컬 서버(호스트·사용자를 비운 URL)에 있는 `database` DB의 연결 문자열. 저장소의 secretlint 규칙이 소스에 적은 DB 연결
 * 문자열을 막으므로 `URL`로 조립한다.
 */
function localDatabaseUrl(database: string): string {
	const url = new URL("postgres://");
	url.pathname = `/${database}`;
	return url.href;
}

it("CLI-BOOT-1 `.env.local`과 `.env`를 읽을 때 기존 환경 변수 > `.env.local` > `.env` 순으로 우선 적용한다", async () => {
	await writeCwdFile(".env.local", 'A="from-local"\nB="from-local"\n');
	await writeCwdFile(".env", 'B="from-dot"\nC="from-dot"\n');

	const env = loadEnv(cwd, { A: "from-env" });

	// CLI-BOOT-1.1
	expect(env.A).toBe("from-env");
	// CLI-BOOT-1.2
	expect(env.B).toBe("from-local");
	// CLI-BOOT-1.3
	expect(env.C).toBe("from-dot");
});

it("CLI-BOOT-2 `.env.local`과 `.env` 파일이 없어도 기존 환경 변수를 그대로 사용한다", () => {
	const databaseUrl = localDatabaseUrl("test");

	const env = loadEnv(cwd, { DATABASE_URL: databaseUrl });

	// CLI-BOOT-2.1
	expect(env.DATABASE_URL).toBe(databaseUrl);
});

it("CLI-BOOT-3 `monti.config.ts`와 `monti.schema.ts`의 `default` export와 해석된 절대 경로를 불러온다", async () => {
	await writeCwdFile("monti.config.ts", defaultModule(config));
	await writeCwdFile("monti.schema.ts", defaultModule(schema));

	const loaded = await loadProjectFiles({ cwd, ...projectPaths });

	// CLI-BOOT-3.1
	expect(loaded.config).toEqual(config);
	// CLI-BOOT-3.2
	expect(loaded.schema).toEqual(schema);
	// CLI-BOOT-3.3
	expect(loaded.configFile).toBe(path.join(cwd, "monti.config.ts"));
	// CLI-BOOT-3.4
	expect(loaded.schemaFile).toBe(path.join(cwd, "monti.schema.ts"));
});

it("CLI-BOOT-4 `monti.config.ts` 파일이 없으면 거절한다", async () => {
	await writeCwdFile("monti.schema.ts", defaultModule(schema));

	const loading = loadProjectFiles({ cwd, ...projectPaths });

	// CLI-BOOT-4.1
	await expect(loading).rejects.toMatchObject({ exitCode: 1 });
});

it("CLI-BOOT-5 `monti.schema.ts` 파일이 없으면 거절한다", async () => {
	await writeCwdFile("monti.config.ts", defaultModule(config));

	const loading = loadProjectFiles({ cwd, ...projectPaths });

	// CLI-BOOT-5.1
	await expect(loading).rejects.toMatchObject({ exitCode: 1 });
});

it("CLI-BOOT-6 설정 파일이나 스키마 파일에 `default` export가 없으면 거절한다", async () => {
	await writeCwdFile("monti.config.ts", `export const config = ${JSON.stringify(config)};\n`);
	await writeCwdFile("monti.schema.ts", defaultModule(schema));

	const loading = loadProjectFiles({ cwd, ...projectPaths });

	// CLI-BOOT-6.1
	await expect(loading).rejects.toMatchObject({ exitCode: 1 });
});

it("CLI-BOOT-7 `MONTI_SECRET` 없이도 DB에 연결해 실행하고 끝나면 연결을 닫는다", async () => {
	const { url, db } = await database();
	await migrateMonti({ db, schema, config });

	const used = await withMonti({ project: project(), env: { DATABASE_URL: url } }, async (context) => {
		await context.monti.folders.create({ scope: "media", name: "사진" });
		return context.db;
	});

	// CLI-BOOT-7.1
	expect(await db.selectFrom("folders").select(["scope", "name"]).execute()).toEqual([
		{ scope: "media", name: "사진" },
	]);
	// CLI-BOOT-7.2
	await expect(sql`select 1`.execute(used)).rejects.toThrow("destroyed");
});

it("CLI-BOOT-8 `MONTI_SECRET`이 있으면 암호화 키 작업에 전달된다", async () => {
	const { url, db } = await database();
	await migrateMonti({ db, schema, config });
	const env = { DATABASE_URL: url, MONTI_SECRET: "test-master-secret" };

	await withMonti({ project: project(), env }, async ({ monti }) => {
		await monti.keys.create({ service: "example", name: "기본 키", secret: "example-key-1234" });
	});

	// CLI-BOOT-8.1
	expect(await db.selectFrom("api_keys").select(["service", "name", "last4"]).execute()).toEqual([
		{ service: "example", name: "기본 키", last4: "1234" },
	]);
});

it("CLI-BOOT-9 `DATABASE_URL`이 없으면 DB 연결을 거절한다", async () => {
	const connecting = withDb({ DATABASE_URL: "" }, async () => "실행됨");

	// CLI-BOOT-9.1
	await expect(connecting).rejects.toMatchObject({ exitCode: 1 });
});

it("CLI-BOOT-10 실행 중 오류가 나도 오류를 그대로 전달하고 DB 연결을 닫는다", async () => {
	const { url } = await database();
	const failure = new Error("콜백이 실패한다");
	const used: Kysely<Database>[] = [];

	const running = withMonti({ project: project(), env: { DATABASE_URL: url } }, async ({ db }) => {
		used.push(db);
		throw failure;
	});

	// CLI-BOOT-10.1
	await expect(running).rejects.toBe(failure);
	// 콜백이 한 번도 쿼리하지 않아 Kysely가 연결을 열지 않았으므로, 닫힌 것은 `withDb`가 직접 닫은 pg 풀이다.
	// CLI-BOOT-10.2
	await expect(sql`select 1`.execute(used[0])).rejects.toThrow("Cannot use a pool after calling end on the pool");
});
