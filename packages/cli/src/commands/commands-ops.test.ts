import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { coreMigrations, type Database, type MontiConfig, migrate, specOf, startMonti } from "@monti-cms/core";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../__test__/database";
import { parseOutput, postsSchema, projectModule, siteConfig, testIo, writeProject } from "../__test__/project";
import { formatGlobalHelp } from "../parse/help";
import { runCli } from "./run";

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

/** `keys` 작업이 키를 암호화하는 비밀값(`MONTI_SECRET`). */
const masterSecret = "test-master-secret";

/** 쓰기 작업 `notes.ping`(받은 `text`를 `pong`으로 돌려준다)을 등록한 플러그인을 쓰는 `monti.config.ts`. */
const notesConfig = `import { defineWrite } from "@monti-cms/core";
import { z } from "zod";

async function ping(input: { text: string }): Promise<{ pong: string }> {
	return { pong: input.text };
}

const notes = { name: "notes", operations: { notes: { ping: defineWrite({ input: z.object({ text: z.string() }), run: ping }) } } };

export default { name: "테스트 사이트", plugins: [notes] };
`;

/** 함수 속성과 자기 자신을 가리키는 속성을 가진 플러그인 `custom`을 쓰는 `monti.config.ts`. */
const customPluginConfig = `function ignoreEvent(): void {}

const custom: Record<string, unknown> = { name: "custom", onEvent: ignoreEvent };
custom.self = custom;

export default { name: "테스트 사이트", plugins: [custom] };
`;

/** `words` 가운데 `text`에 들어 있지 않은 것. */
function missingFrom(text: string, words: string[]): string[] {
	return words.filter((word) => !text.includes(word));
}

/** core로 API 키 하나를 저장하고 그 `id`를 돌려준다. */
async function storeKey(db: Kysely<Database>): Promise<string> {
	const monti = await startMonti({
		db,
		schema: postsSchema,
		config: siteConfig,
		configFile: path.join(cwd, "monti.config.ts"),
		schemaFile: path.join(cwd, "monti.schema.ts"),
		secret: masterSecret,
	});
	const key = await monti.keys.create({ service: "openai", name: "main", secret: "sk-test-1234" });
	return key.id;
}

it("CLI-OPS-1 전역 `--help`는 설정 파일과 DB 없이 전체 도움말을 `stdout`에 출력한다", async () => {
	const { io, stdout, stderr } = testIo(cwd);

	const code = await runCli(["--help"], io);

	// CLI-OPS-1.1
	expect(code).toBe(0);
	// CLI-OPS-1.2
	expect(stdout()).toBe(`${formatGlobalHelp()}\n`);
	// CLI-OPS-1.3
	expect(stderr()).toBe("");
});

it("CLI-OPS-2 인자 없이 실행하면 전체 도움말을 `stdout`에 출력한다", async () => {
	const { io, stdout, stderr } = testIo(cwd);

	const code = await runCli([], io);

	// CLI-OPS-2.1
	expect(code).toBe(0);
	// CLI-OPS-2.2
	expect(stdout()).toBe(`${formatGlobalHelp()}\n`);
	// CLI-OPS-2.3
	expect(stderr()).toBe("");
});

it("CLI-OPS-3 플러그인이 더한 작업도 DB 없이 `--help`로 옵션을 볼 수 있다", async () => {
	await writeProject(cwd, { "monti.config.ts": notesConfig });
	const { io, stdout, stderr } = testIo(cwd);

	const code = await runCli(["notes", "ping", "--help"], io);

	// CLI-OPS-3.1
	expect(code).toBe(0);
	// CLI-OPS-3.2
	expect(missingFrom(stdout(), ["--text", "--input", "--dry-run"])).toEqual([]);
	// CLI-OPS-3.3
	expect(stderr()).toBe("");
});

it("CLI-OPS-4 `--version`은 설정 파일과 DB 없이 패키지 버전을 `stdout`에 출력한다", async () => {
	const { version } = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
	const { io, stdout, stderr } = testIo(cwd);

	const code = await runCli(["--version"], io);

	// CLI-OPS-4.1
	expect(code).toBe(0);
	// CLI-OPS-4.2
	expect(stdout()).toBe(`${version}\n`);
	// CLI-OPS-4.3
	expect(stderr()).toBe("");
});

it("CLI-OPS-5 `spec`은 DB 없이 코어와 플러그인의 작업 명세를 JSON으로 출력한다", async () => {
	await writeProject(cwd, { "monti.config.ts": notesConfig });
	const { io, stdout, stderr } = testIo(cwd);

	const code = await runCli(["spec"], io);

	const config = (await projectModule(cwd, "monti.config.ts")).default as MontiConfig;
	// CLI-OPS-5.1
	expect(code).toBe(0);
	// CLI-OPS-5.2
	expect(parseOutput(stdout())).toEqual(specOf(config.plugins));
	// CLI-OPS-5.3
	expect(stderr()).toBe("");
});

it("CLI-OPS-6 알 수 없는 리소스나 작업의 `--help`는 사용법 오류로 거절한다", async () => {
	await writeProject(cwd);
	const { io, stdout, stderr } = testIo(cwd);

	const code = await runCli(["no_such_resource", "--help"], io);

	// CLI-OPS-6.1
	expect(code).toBe(2);
	// CLI-OPS-6.2
	expect(stderr()).toMatch(/\S/);
	// CLI-OPS-6.3
	expect(stdout()).toBe("");
});

it("CLI-OPS-7 플러그인이 등록한 작업을 실행해 결과를 순수 JSON으로 출력한다", async () => {
	const { url } = await database();
	await writeProject(cwd, { "monti.config.ts": notesConfig });
	const { io, stdout, stderr } = testIo(cwd, { env: { DATABASE_URL: url } });

	const code = await runCli(["notes", "ping", "--text", "hi"], io);

	// CLI-OPS-7.1
	expect(code).toBe(0);
	// CLI-OPS-7.2
	expect(parseOutput(stdout())).toEqual({ pong: "hi" });
	// CLI-OPS-7.3
	expect(stderr()).toBe("");
});

it("CLI-OPS-8 반환값이 없는 작업을 실행하면 변경을 적용하고 `stdout`에 `null`을 출력한다", async () => {
	const { url, db } = await database();
	await writeProject(cwd);
	const keyId = await storeKey(db);
	const { io, stdout } = testIo(cwd, { env: { DATABASE_URL: url } });

	const code = await runCli(["keys", "delete", "--id", keyId], io);

	// CLI-OPS-8.1
	expect(code).toBe(0);
	// CLI-OPS-8.2
	expect(parseOutput(stdout())).toBeNull();
	// CLI-OPS-8.3
	expect(await db.selectFrom("api_keys").select("id").where("id", "=", keyId).execute()).toEqual([]);
});

it("CLI-OPS-9 함수나 순환 참조가 섞인 설정 객체도 직렬화 가능한 값을 보존하며 JSON으로 출력한다", async () => {
	const { url } = await database();
	await writeProject(cwd, { "monti.config.ts": customPluginConfig });
	const { io, stdout } = testIo(cwd, { env: { DATABASE_URL: url } });

	const code = await runCli(["config", "get"], io);

	const output = parseOutput(stdout()) as { plugins?: unknown };
	// CLI-OPS-9.1
	expect(code).toBe(0);
	// CLI-OPS-9.2
	expect(output).toMatchObject({ name: "테스트 사이트" });
	// CLI-OPS-9.3
	expect(output.plugins).toMatchObject([{ name: "custom" }]);
});

it("CLI-OPS-10 쓰기 작업에 `--dry-run`을 붙이면 결과만 출력하고 변경을 저장하지 않는다", async () => {
	const { url, db } = await database();
	await migrate(db, "@monti-cms/core", coreMigrations);
	await writeProject(cwd);
	const { io, stdout } = testIo(cwd, { env: { DATABASE_URL: url } });

	const code = await runCli(["folders", "create", "--scope", "posts", "--name", "시험", "--dry-run"], io);

	// CLI-OPS-10.1
	expect(code).toBe(0);
	// CLI-OPS-10.2
	expect(parseOutput(stdout())).toMatchObject({ name: "시험" });
	// CLI-OPS-10.3
	expect(await db.selectFrom("folders").select("id").where("name", "=", "시험").execute()).toEqual([]);
});

it("CLI-OPS-11 대화형 터미널에서 필수 민감 필드가 빠지면 숨김 입력으로 받아 실행한다", async () => {
	const { url, db } = await database();
	await writeProject(cwd);
	const env = { DATABASE_URL: url, MONTI_SECRET: masterSecret };
	const { io, prompts } = testIo(cwd, { env, isTTY: true, secret: "sk-test-9876" });

	const code = await runCli(["keys", "create", "--service", "openai", "--name", "main"], io);

	// CLI-OPS-11.1
	expect(prompts).toEqual(["secret"]);
	// CLI-OPS-11.2
	expect(code).toBe(0);
	// CLI-OPS-11.3
	expect(await db.selectFrom("api_keys").select("last4").execute()).toEqual([{ last4: "9876" }]);
});

it("CLI-OPS-12 선택 민감 필드는 대화형 터미널에서도 숨김 입력을 묻지 않는다", async () => {
	const { url, db } = await database();
	await writeProject(cwd);
	const keyId = await storeKey(db);
	const env = { DATABASE_URL: url, MONTI_SECRET: masterSecret };
	const { io, prompts } = testIo(cwd, { env, isTTY: true, secret: "sk-test-0000" });

	const code = await runCli(["keys", "update", "--id", keyId, "--name", "renamed"], io);

	// CLI-OPS-12.1
	expect(prompts).toEqual([]);
	// CLI-OPS-12.2
	expect(code).toBe(0);
	// CLI-OPS-12.3
	expect(await db.selectFrom("api_keys").select("name").where("id", "=", keyId).execute()).toEqual([
		{ name: "renamed" },
	]);
});

it("CLI-OPS-13 비대화형 터미널에서 필수 민감 필드가 빠지면 숨김 입력을 묻지 않고 거절한다", async () => {
	const { url } = await database();
	await writeProject(cwd);
	const env = { DATABASE_URL: url, MONTI_SECRET: masterSecret };
	const { io, stderr, prompts } = testIo(cwd, { env, isTTY: false, secret: "sk-test-9876" });

	const code = await runCli(["keys", "create", "--service", "openai", "--name", "main"], io);

	// CLI-OPS-13.1
	expect(prompts).toEqual([]);
	// CLI-OPS-13.2
	expect(code).toBe(1);
	// CLI-OPS-13.3
	expect(stderr()).toMatch(/^\[BAD_REQUEST\] /);
});

it("CLI-OPS-14 읽기 작업에 `--dry-run`을 붙이면 DB를 열지 않고 사용법 오류로 거절한다", async () => {
	await writeProject(cwd);
	const { io, stdout, stderr } = testIo(cwd);

	const code = await runCli(["folders", "list", "--scope", "posts", "--dry-run"], io);

	// CLI-OPS-14.1
	expect(code).toBe(2);
	// CLI-OPS-14.2
	expect(stderr()).toMatch(/\S/);
	// CLI-OPS-14.3
	expect(stdout()).toBe("");
});

it("CLI-OPS-15 알 수 없는 명령은 사용법 오류로 거절한다", async () => {
	await writeProject(cwd);
	const { io, stdout, stderr } = testIo(cwd);

	const code = await runCli(["unknown-cmd"], io);

	// CLI-OPS-15.1
	expect(code).toBe(2);
	// CLI-OPS-15.2
	expect(stderr()).toMatch(/\S/);
	// CLI-OPS-15.3
	expect(stdout()).toBe("");
});

it("CLI-OPS-16 `--input`과 개별 플래그를 함께 주면 사용법 오류로 거절한다", async () => {
	await writeProject(cwd);
	const { io, stdout, stderr } = testIo(cwd);

	const code = await runCli(["folders", "list", "--input", '{"scope":"posts"}', "--scope", "posts"], io);

	// CLI-OPS-16.1
	expect(code).toBe(2);
	// CLI-OPS-16.2
	expect(stderr()).toMatch(/\S/);
	// CLI-OPS-16.3
	expect(stdout()).toBe("");
});

it("CLI-OPS-17 작업이 코어 오류로 거절되면 이유를 `[코드] 메시지` 형식으로 `stderr`에 출력한다", async () => {
	const { url } = await database();
	await writeProject(cwd);
	const { io, stdout, stderr } = testIo(cwd, { env: { DATABASE_URL: url } });

	const code = await runCli(["keys", "delete", "--id", "missing-key-id"], io);

	// CLI-OPS-17.1
	expect(code).toBe(1);
	// CLI-OPS-17.2
	expect(stderr()).toMatch(/^\[NOT_FOUND\] \S/);
	// CLI-OPS-17.3
	expect(stdout()).toBe("");
});
