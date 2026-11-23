import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { type Database, type MontiConfig, migrate, migrateMonti, type Plugin, type Schema } from "@monti-cms/core";
import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
	columnsOf,
	createTestDatabase,
	recordedMigrations,
	type TestDatabase,
	tableExists,
} from "../__test__/database";
import { getMigrationStatus, type LoadedProject, runMigrations } from "./runner";

let testDb: TestDatabase;
/** 테스트마다 새로 만드는 임시 프로젝트 디렉터리. */
let root: string;
/** 프로젝트의 마이그레이션 폴더. */
let dir: string;

beforeEach(async () => {
	testDb = await createTestDatabase();
	root = await mkdtemp(path.join(tmpdir(), "monti-cli-"));
	dir = path.join(root, "migrations");
	await mkdir(dir);
});

afterEach(async () => {
	await testDb.drop();
	await rm(root, { recursive: true, force: true });
});

const schema: Schema = {
	locales: ["ko"],
	collections: { posts: { fields: { title: { type: "text" } } } },
};

/** 코어 `folders`를 참조하는 `plugin_tags` 테이블을 만든다. */
async function createPluginTags(db: Kysely<unknown>): Promise<void> {
	await sql`create table plugin_tags (id uuid primary key, folder_id uuid references folders (id))`.execute(db);
}

/** 코어 테이블을 참조하는 테이블을 만드는 플러그인. */
const tagsPlugin: Plugin = { name: "tags-plugin", migrations: [{ name: "0001-plugin-tags", up: createPluginTags }] };

/** 아무것도 바꾸지 않는 마이그레이션 단계. 기록만 남길 때 쓴다. */
async function changeNothing(): Promise<void> {
	// 바꾸는 것이 없다.
}

/** 플러그인 테이블과 코어 `folders(id)`를 참조하는 `posts` 테이블과 그 `posts_data` 테이블을 만드는 SQL. */
const initSql = `create table posts (
	id uuid primary key,
	folder_id uuid references folders (id),
	tag_id uuid references plugin_tags (id)
);
create table posts_data (id uuid primary key references posts (id), title text);
`;

const addSubtitleSql = "alter table posts_data add column subtitle text;\n";

/** `config`를 설정으로 쓰고, 설정·스키마 파일이 `root`에 있는 프로젝트. */
function projectWith(config: MontiConfig): LoadedProject {
	return {
		config,
		schema,
		configFile: path.join(root, "monti.config.ts"),
		schemaFile: path.join(root, "monti.schema.ts"),
	};
}

/** `config.dev`를 생략하고 `tagsPlugin`을 쓰는 프로젝트. */
function pluginProject(): LoadedProject {
	return projectWith({ name: "테스트", plugins: [tagsPlugin] });
}

/** 마이그레이션 폴더에 `.sql` 파일을 쓴다. */
async function writeSql(name: string, text: string): Promise<void> {
	await writeFile(path.join(dir, name), text);
}

it("CLI-MGR-1 내장 마이그레이션 뒤에 아직 적용하지 않은 프로젝트 SQL 파일을 이름 순서대로 적용한다", async () => {
	await writeSql("0002_add_subtitle.sql", addSubtitleSql);
	await writeSql("0001_init.sql", initSql);

	const applied = await runMigrations({ db: testDb.db, project: pluginProject(), dir });

	// CLI-MGR-1.1
	expect(applied).toEqual(["0001_init.sql", "0002_add_subtitle.sql"]);
	// CLI-MGR-1.2
	expect(await recordedMigrations(testDb.db)).toEqual([
		["@monti-cms/core", "0001-initial"],
		["project", "0001_init.sql"],
		["project", "0002_add_subtitle.sql"],
		["tags-plugin", "0001-plugin-tags"],
	]);
	const tables = { posts: await tableExists(testDb.db, "posts"), postsData: await columnsOf(testDb.db, "posts_data") };
	// CLI-MGR-1.3
	expect(tables).toEqual({ posts: true, postsData: expect.arrayContaining(["subtitle"]) });
});

it("CLI-MGR-2 이미 적용된 SQL 파일은 건너뛰고 새로 추가된 파일만 적용한다", async () => {
	await writeSql("0001_init.sql", initSql);
	await runMigrations({ db: testDb.db, project: pluginProject(), dir });
	await writeSql("0002_add_subtitle.sql", addSubtitleSql);

	const applied = await runMigrations({ db: testDb.db, project: pluginProject(), dir });

	// CLI-MGR-2.1
	expect(applied).toEqual(["0002_add_subtitle.sql"]);
	// CLI-MGR-2.2
	expect(await columnsOf(testDb.db, "posts_data")).toContain("subtitle");
	// CLI-MGR-2.3
	expect(await recordedMigrations(testDb.db)).toContainEqual(["project", "0002_add_subtitle.sql"]);
});

it("CLI-MGR-3 `--dry-run`은 빈 DB에서도 내장·프로젝트 마이그레이션을 시험 실행만 하고 변경을 남기지 않는다", async () => {
	await writeSql("0001_init.sql", initSql);
	await writeSql("0002_add_subtitle.sql", addSubtitleSql);

	const tried = await runMigrations({ db: testDb.db, project: pluginProject(), dir, dryRun: true });

	// CLI-MGR-3.1
	expect(tried).toEqual(["0001_init.sql", "0002_add_subtitle.sql"]);
	// CLI-MGR-3.2
	expect(await tableExists(testDb.db, "posts")).toBe(false);
	const tables = {
		folders: await tableExists(testDb.db, "folders"),
		migrations: await tableExists(testDb.db, "migrations"),
	};
	// CLI-MGR-3.3
	expect(tables).toEqual({ folders: false, migrations: false });
});

it("CLI-MGR-9 이미 일부 마이그레이션이 적용된 DB에서 `--dry-run`을 실행하면 이미 적용된 단계는 건너뛰고 새 파일만 시험 실행한 뒤 롤백한다", async () => {
	await writeSql("0001_init.sql", initSql);
	await runMigrations({ db: testDb.db, project: pluginProject(), dir });
	await writeSql("0002_add_subtitle.sql", addSubtitleSql);

	const tried = await runMigrations({ db: testDb.db, project: pluginProject(), dir, dryRun: true });

	// CLI-MGR-9.1
	expect(tried).toEqual(["0002_add_subtitle.sql"]);
	// CLI-MGR-9.2
	expect(await columnsOf(testDb.db, "posts_data")).not.toContain("subtitle");
	// CLI-MGR-9.3
	expect(await recordedMigrations(testDb.db)).not.toContainEqual(["project", "0002_add_subtitle.sql"]);
});

it("CLI-MGR-4 `--dry-run` 중 실행 오류가 나면 오류를 던지고 앞선 변경을 모두 롤백한다", async () => {
	// 문법은 맞아 앞의 `create table`까지 실제로 실행된 뒤, 0으로 나누기(`22012`)에서 실패한다.
	await writeSql("0001_broken.sql", "create table broken_step (id integer);\nselect 1 / 0;\n");

	const tried = runMigrations({ db: testDb.db, project: projectWith({ name: "테스트" }), dir, dryRun: true });

	// CLI-MGR-4.1
	await expect(tried).rejects.toMatchObject({ code: "22012" });
	const tables = {
		created: await tableExists(testDb.db, "broken_step"),
		migrations: await tableExists(testDb.db, "migrations"),
	};
	// CLI-MGR-4.2
	expect(tables).toEqual({ created: false, migrations: false });
});

it("CLI-MGR-5 중간 SQL 파일이 실패하면 해당 파일만 롤백하고 뒤 파일은 실행하지 않는다", async () => {
	await writeSql("0001_step_one.sql", "create table step_one (id integer);\n");
	await writeSql("0002_step_two.sql", "create table step_two (id integer);\nselect 1 / 0;\n");
	await writeSql("0003_step_three.sql", "create table step_three (id integer);\n");

	const applying = runMigrations({ db: testDb.db, project: projectWith({ name: "테스트" }), dir });

	// CLI-MGR-5.1
	await expect(applying).rejects.toMatchObject({ code: "22012" });
	const first = { table: await tableExists(testDb.db, "step_one"), recorded: await recordedMigrations(testDb.db) };
	// CLI-MGR-5.2
	expect(first).toEqual({ table: true, recorded: expect.arrayContaining([["project", "0001_step_one.sql"]]) });
	const later = { two: await tableExists(testDb.db, "step_two"), three: await tableExists(testDb.db, "step_three") };
	// CLI-MGR-5.3
	expect(later).toEqual({ two: false, three: false });
	// CLI-MGR-5.4
	expect(await recordedMigrations(testDb.db)).toEqual([
		["@monti-cms/core", "0001-initial"],
		["project", "0001_step_one.sql"],
	]);
});

it("CLI-MGR-6 개발 서버 설정으로는 운영 마이그레이션을 적용할 수 없다", async () => {
	await writeSql("0001_step_one.sql", "create table step_one (id integer);\n");

	const applying = runMigrations({ db: testDb.db, project: projectWith({ name: "테스트", dev: true }), dir });

	// CLI-MGR-6.1
	await expect(applying).rejects.toMatchObject({ exitCode: 1 });
	// CLI-MGR-6.2
	expect(await tableExists(testDb.db, "posts")).toBe(false);
	// CLI-MGR-6.3
	expect(await tableExists(testDb.db, "migrations")).toBe(false);
});

it("CLI-MGR-7 아무것도 적용하지 않은 DB의 상태를 조회하면 테이블을 만들지 않고 모두 미적용으로 돌려준다", async () => {
	await writeSql("0001_init.sql", initSql);
	await writeSql("0002_add_subtitle.sql", addSubtitleSql);

	const status = await getMigrationStatus({ db: testDb.db, dir });

	// CLI-MGR-7.1
	expect(status).toEqual([
		{ name: "0001_init.sql", applied: false },
		{ name: "0002_add_subtitle.sql", applied: false },
	]);
	// CLI-MGR-7.2
	expect(await tableExists(testDb.db, "migrations")).toBe(false);
});

it("CLI-MGR-8 일부만 적용된 DB의 상태를 조회하면 프로젝트 출처의 적용 이력만 반영해 돌려준다", async () => {
	await migrate(testDb.db, "project", [{ name: "0001_init.sql", up: changeNothing }]);
	await migrate(testDb.db, "other-plugin", [{ name: "0002_add_subtitle.sql", up: changeNothing }]);
	await writeSql("0001_init.sql", initSql);
	await writeSql("0002_add_subtitle.sql", addSubtitleSql);

	const status = await getMigrationStatus({ db: testDb.db, dir });

	// CLI-MGR-8.1
	expect(status).toEqual([
		{ name: "0001_init.sql", applied: true },
		{ name: "0002_add_subtitle.sql", applied: false },
	]);
});

/** 내장 마이그레이션(core)만 적용한다: `monti migrate up`을 한 번 거친 운영 DB처럼 된다. */
async function migrateBuiltIns(): Promise<void> {
	await migrateMonti({ db: testDb.db, schema, config: { name: "테스트" } });
}

/** `migrations` 테이블에 `"project"` 출처로 기록된 행. */
async function projectRecords(): Promise<[string, string][]> {
	return (await recordedMigrations(testDb.db)).filter(([source]) => source === "project");
}

it("CLI-MGR-12 같은 DB에 운영 마이그레이션을 동시에 두 번 실행해도 각 파일은 한 번만 적용되고 자신이 적용한 파일만 돌려준다", async () => {
	await migrateBuiltIns();
	// 앞의 잠시 멈춤이 첫 호출의 잠금을 붙잡아, 그동안 두 번째 호출이 들어온다.
	await writeSql("0001_init.sql", "select pg_sleep(0.5);\ncreate table posts (id uuid primary key);\n");
	const other = new Kysely<Database>({
		dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: testDb.url, max: 4 }) }),
	});
	await sql`select 1`.execute(other);
	const project = projectWith({ name: "테스트" });

	const results = await Promise.allSettled([testDb.db, other].map((db) => runMigrations({ db, project, dir }))).finally(
		() => other.destroy(),
	);

	// CLI-MGR-12.1
	expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
	const applied = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
	// CLI-MGR-12.2
	expect(applied.sort((a, b) => a.length - b.length)).toEqual([[], ["0001_init.sql"]]);
	// CLI-MGR-12.3
	expect(await projectRecords()).toEqual([["project", "0001_init.sql"]]);
});
