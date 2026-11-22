import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "kysely";
import { afterEach, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../src/__test__/database";
import { defaultModule, parseOutput, writeProject } from "../src/__test__/project";

/** 실제 터미널 실행 파일 경로(`packages/cli/src/bin.mjs`). */
const binPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/bin.mjs");

/** 시나리오별 제한 시간(자식 프로세스 연속 실행 포함). */
const SCENARIO = { timeout: 60_000 };

/** 자식 프로세스 한 번 실행 결과. */
interface CliResult {
	status: number | null;
	stdout: string;
	stderr: string;
}

/** 한 시나리오의 임시 DB와 임시 디렉터리 묶음. */
interface Workspace {
	testDb: TestDatabase;
	dir: string;
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
	const errors: unknown[] = [];
	while (cleanups.length > 0) {
		const run = cleanups.pop();
		if (run === undefined) continue;
		try {
			await run();
		} catch (error) {
			errors.push(error);
		}
	}
	if (errors.length > 0) throw new AggregateError(errors, "임시 테스트 자원 정리에 실패했다");
});

/** 독립된 임시 PostgreSQL DB와 임시 프로젝트 디렉터리를 만들고 정리 훅에 등록한다. */
async function createWorkspace(): Promise<Workspace> {
	const testDb = await createTestDatabase();
	cleanups.push(() => testDb.drop());
	const dir = await mkdtemp(path.join(tmpdir(), "monti-cli-e2e-"));
	cleanups.push(() => rm(dir, { recursive: true, force: true }));
	return { testDb, dir };
}

/** 부모의 PostgreSQL 접속 변수는 유지하되, `.env`로 주입할 테스트 전용 키는 비운 자식 환경을 만든다. */
function childEnv(): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = { ...process.env };
	delete env.DATABASE_URL;
	delete env.MONTI_SECRET;
	delete env.STORAGE_LOG_FILE;
	return env;
}

/** 실제 `node packages/cli/src/bin.mjs` 자식 프로세스를 격리된 환경으로 실행한다. */
function runBin(cwd: string, args: string[], input?: string): CliResult {
	const result = spawnSync(process.execPath, [binPath, ...args], {
		cwd,
		env: childEnv(),
		input,
		encoding: "utf8",
		timeout: 20_000,
	});
	if (result.error !== undefined) throw result.error;
	return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** DB에 `table`이 존재하는지 확인한다. */
async function hasTable(ws: Workspace, table: string): Promise<boolean> {
	const { rows } = await sql<{ name: string | null }>`select to_regclass(${table}) as name`.execute(ws.testDb.db);
	return rows[0]?.name !== null;
}

/** `table`의 `column` 열이 존재하는지 확인한다. */
async function hasColumn(ws: Workspace, table: string, column: string): Promise<boolean> {
	const { rows } = await sql<{ exists: boolean }>`
		select exists (
			select 1 from information_schema.columns
			where table_schema = 'public' and table_name = ${table} and column_name = ${column}
		) as exists
	`.execute(ws.testDb.db);
	return rows[0]?.exists === true;
}

/** `migrations` 테이블의 `(source, name)` 쌍을 정렬해 돌려준다. */
async function recordedMigrations(ws: Workspace): Promise<Array<[string, string]>> {
	const { rows } = await sql<{ source: string; name: string }>`
		select source, name from migrations order by source, name
	`.execute(ws.testDb.db);
	return rows.map((row) => [row.source, row.name]);
}

/** 시나리오 1의 1단계: `0001_initial.sql` 생성, `status`, `--dry-run`, 실제 `up`을 검증한다. */
async function runInitialMigrationJourney(ws: Workspace): Promise<void> {
	const gen1 = runBin(ws.dir, ["migrate", "generate", "initial"]);
	expect(gen1.status).toBe(0);
	expect(parseOutput(gen1.stdout)).toMatchObject({ filename: "0001_initial.sql" });

	const statusBefore = runBin(ws.dir, ["migrate", "status"]);
	expect(statusBefore.status).toBe(0);
	expect(parseOutput(statusBefore.stdout)).toEqual([{ name: "0001_initial.sql", applied: false }]);
	expect(await hasTable(ws, "migrations")).toBe(false);

	const dry = runBin(ws.dir, ["migrate", "up", "--dry-run"]);
	expect(dry.status).toBe(0);
	expect(parseOutput(dry.stdout)).toEqual(["0001_initial.sql"]);
	expect(await hasTable(ws, "migrations")).toBe(false);
	expect(await hasTable(ws, "posts")).toBe(false);

	const up1 = runBin(ws.dir, ["migrate", "up"]);
	expect(up1.status).toBe(0);
	expect(up1.stderr).toContain(new URL(ws.testDb.url).pathname.slice(1));
	expect(parseOutput(up1.stdout)).toEqual(["0001_initial.sql"]);
	expect(await hasTable(ws, "posts")).toBe(true);
	expect(await recordedMigrations(ws)).toEqual([
		["@monti-cms/core", "0001-initial"],
		["project", "0001_initial.sql"],
	]);
}

/** 시나리오 1의 2단계: 스키마 변경 → `0002` 생성 → 오타 차단 → 실패 SQL 시험 실행 롤백 → 실제 `up`을 검증한다. */
async function runSchemaEvolutionJourney(ws: Workspace): Promise<void> {
	const statusAfter = runBin(ws.dir, ["migrate", "status"]);
	expect(statusAfter.status).toBe(0);
	expect(parseOutput(statusAfter.stdout)).toEqual([{ name: "0001_initial.sql", applied: true }]);

	const evolved = {
		locales: ["ko"],
		collections: { posts: { fields: { title: { type: "text" }, subtitle: { type: "text" } } } },
	};
	await writeFile(path.join(ws.dir, "monti.schema.ts"), defaultModule(evolved));

	const gen2 = runBin(ws.dir, ["migrate", "generate", "add subtitle"]);
	expect(gen2.status).toBe(0);
	expect(parseOutput(gen2.stdout)).toMatchObject({ filename: "0002_add_subtitle.sql" });

	const typo = runBin(ws.dir, ["migrate", "up", "--dry-rnu"]);
	expect(typo.status).toBe(2);
	expect(typo.stderr).toContain("--dry-rnu");
	expect(typo.stdout).toBe("");
	expect(await hasColumn(ws, "posts_data", "subtitle")).toBe(false);

	const brokenSql = path.join(ws.dir, "migrations", "0003_broken.sql");
	await writeFile(brokenSql, "create table broken_tmp (id int); select 1 / 0;\n");
	const brokenDry = runBin(ws.dir, ["migrate", "up", "--dry-run"]);
	await unlink(brokenSql);
	expect(brokenDry.status).toBe(1);
	expect(await hasTable(ws, "broken_tmp")).toBe(false);
	expect(await hasColumn(ws, "posts_data", "subtitle")).toBe(false);

	const dry2 = runBin(ws.dir, ["migrate", "up", "--dry-run"]);
	expect(dry2.status).toBe(0);
	expect(parseOutput(dry2.stdout)).toEqual(["0002_add_subtitle.sql"]);
	expect(await hasColumn(ws, "posts_data", "subtitle")).toBe(false);

	const up2 = runBin(ws.dir, ["migrate", "up"]);
	expect(up2.status).toBe(0);
	expect(parseOutput(up2.stdout)).toEqual(["0002_add_subtitle.sql"]);
	expect(await hasColumn(ws, "posts_data", "subtitle")).toBe(true);
}

it(
	"시나리오 1: bin.mjs로 운영 마이그레이션 생성·상태·시험 실행·오타 차단·적용·스키마 진화를 연속 수행한다",
	SCENARIO,
	async () => {
		const ws = await createWorkspace();
		await writeProject(ws.dir, {
			"monti.config.ts": defaultModule({ name: "운영 블로그", dev: false }),
		});
		await writeFile(path.join(ws.dir, ".env"), `DATABASE_URL=${ws.testDb.url}\n`);
		await runInitialMigrationJourney(ws);
		await runSchemaEvolutionJourney(ws);
	},
);

/** `.env`의 `STORAGE_LOG_FILE`을 읽어 삭제된 키를 기록하는 파일 저장소 설정 모듈을 만든다. */
function storageConfigSource(): string {
	return [
		'import { appendFile } from "node:fs/promises";',
		"const logFile = process.env.STORAGE_LOG_FILE;",
		"const storage = {",
		'  ticket: async (key: string) => ({ url: "https://example.invalid/" + key, headers: {} }),',
		"  stat: async () => null,",
		'  url: (key: string) => "https://example.invalid/" + key,',
		"  remove: async (key: string) => {",
		'    if (!logFile) throw new Error("STORAGE_LOG_FILE missing");',
		'    await appendFile(logFile, key + "\\n");',
		"  },",
		"};",
		'export default { name: "운영 블로그", dev: false, storage };',
		"",
	].join("\n");
}

/** 시나리오 2의 1단계: `spec` → 폴더 생성 → `--input -` 글 작성 → `--dry-run` 발행·실제 발행을 검증한다. */
async function runContentWorkflow(ws: Workspace): Promise<void> {
	const spec = runBin(ws.dir, ["spec"]);
	expect(spec.status).toBe(0);
	const names = (parseOutput(spec.stdout) as Array<{ name: string }>).map((item) => item.name);
	expect(names).toContain("entries.create");
	expect(names).toContain("folders.create");

	const folderRes = runBin(ws.dir, ["folders", "create", "--scope", "posts", "--name", "공지"]);
	expect(folderRes.status).toBe(0);
	const folder = parseOutput(folderRes.stdout) as { id: string; name: string };
	expect(folder.id).toBeTypeOf("string");
	expect(folder.name).toBe("공지");

	const payload = JSON.stringify({
		collection: "posts",
		locale: "ko",
		folder_id: folder.id,
		slug: "hello",
		fields: { title: "첫 글" },
	});
	const entryRes = runBin(ws.dir, ["entries", "create", "--input", "-"], payload);
	expect(entryRes.status).toBe(0);
	const entry = parseOutput(entryRes.stdout) as { id: string };

	const dryPub = runBin(ws.dir, ["entries", "publish", "--id", entry.id, "--dry-run"]);
	expect(dryPub.status).toBe(0);
	expect(parseOutput(dryPub.stdout)).toMatchObject({
		id: entry.id,
		slug: "hello",
		folder_id: folder.id,
		published_at: expect.any(String),
	});
	const pubRows = await sql<{ count: string }>`
		select count(*)::text as count from posts_data where entry_id = ${entry.id} and status = 'published'
	`.execute(ws.testDb.db);
	expect(pubRows.rows[0]?.count).toBe("0");

	const pub = runBin(ws.dir, ["entries", "publish", "--id", entry.id]);
	expect(pub.status).toBe(0);
	const live = runBin(ws.dir, ["entries", "get", "--id", entry.id, "--status", "published"]);
	expect(live.status).toBe(0);
	expect(parseOutput(live.stdout)).toMatchObject({
		id: entry.id,
		slug: "hello",
		folder_id: folder.id,
		fields: { title: "첫 글" },
	});
}

it(
	"시나리오 2: bin.mjs로 명세 조회·폴더 생성·표준 입력 글 작성·발행 시험/적용·.env 기반 임시 파일 정리를 연속 수행한다",
	SCENARIO,
	async () => {
		const ws = await createWorkspace();
		const logFile = path.join(ws.dir, "removed-keys.log");
		await writeProject(ws.dir, { "monti.config.ts": storageConfigSource() });
		await writeFile(path.join(ws.dir, ".env"), `DATABASE_URL=${ws.testDb.url}\nSTORAGE_LOG_FILE=${logFile}\n`);

		expect(runBin(ws.dir, ["migrate", "generate", "init"]).status).toBe(0);
		expect(runBin(ws.dir, ["migrate", "up"]).status).toBe(0);

		await runContentWorkflow(ws);

		await sql`insert into loose_files (key, remove_after) values ('expired/tmp.png', now() - interval '1 hour')`.execute(
			ws.testDb.db,
		);
		const cleaned = runBin(ws.dir, ["clean-files"]);
		expect(cleaned.status).toBe(0);
		expect(parseOutput(cleaned.stdout)).toBeNull();
		expect((await readFile(logFile, "utf8")).trim()).toBe("expired/tmp.png");
		const remaining = await sql<{ count: string }>`select count(*)::text as count from loose_files`.execute(
			ws.testDb.db,
		);
		expect(remaining.rows[0]?.count).toBe("0");
	},
);
