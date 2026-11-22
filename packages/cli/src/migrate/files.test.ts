import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { type Schema, snapshotOf } from "@monti-cms/core";
import { afterEach, beforeEach, expect, it } from "vitest";
import { generateMigration, listMigrationFiles } from "./files";

/** 테스트마다 새로 만드는 빈 임시 디렉터리. */
let root: string;
/** 마이그레이션 폴더. 처음 만들 때처럼 아직 없다. */
let dir: string;

const posts: Schema = {
	locales: ["ko"],
	collections: { posts: { fields: { title: { type: "text" } } } },
};

/** `posts`에 `text` 필드 `subtitle`을 더한 스키마. */
const postsWithSubtitle: Schema = {
	locales: ["ko"],
	collections: { posts: { fields: { title: { type: "text" }, subtitle: { type: "text" } } } },
};

beforeEach(async () => {
	root = await mkdtemp(path.join(tmpdir(), "monti-cli-"));
	dir = path.join(root, "migrations");
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

/** 마이그레이션 폴더의 `_snapshot.json`을 읽어 JSON으로 돌려준다. */
async function savedSnapshot(): Promise<unknown> {
	return JSON.parse(await readFile(path.join(dir, "_snapshot.json"), "utf8"));
}

/** `0001_init_posts.sql`과 `posts` 스키마의 `_snapshot.json`이 있는 마이그레이션 폴더를 만든다. */
async function initPosts(): Promise<void> {
	await generateMigration({ dir, schema: posts, name: "init posts" });
}

it("CLI-MGF-1 처음 마이그레이션을 만들면 `0001_<이름>.sql` 파일과 `_snapshot.json`을 저장한다", async () => {
	const generated = await generateMigration({ dir, schema: posts, name: "init posts" });
	// CLI-MGF-1.1
	expect(generated).toMatchObject({ filename: "0001_init_posts.sql", sql: expect.stringMatching(/\S/) });
	// CLI-MGF-1.2
	expect(await readFile(path.join(dir, "0001_init_posts.sql"), "utf8")).toContain('create table "posts"');
	// CLI-MGF-1.3
	expect(await savedSnapshot()).toEqual(snapshotOf(posts));
});

it("CLI-MGF-2 기존 마이그레이션이 있으면 다음 4자리 번호로 변경분 SQL 파일을 추가하고 `_snapshot.json`을 갱신한다", async () => {
	await initPosts();
	const generated = await generateMigration({ dir, schema: postsWithSubtitle });
	// CLI-MGF-2.1
	expect(generated?.filename).toBe("0002_schema_update.sql");
	// CLI-MGF-2.2
	expect(await readFile(path.join(dir, "0002_schema_update.sql"), "utf8")).toBe(
		'alter table "posts_data" add column "subtitle" text;\n',
	);
	// CLI-MGF-2.3
	expect(await savedSnapshot()).toEqual(snapshotOf(postsWithSubtitle));
});

it("CLI-MGF-3 스키마가 직전 `_snapshot.json`과 같으면 새 `.sql` 파일을 만들지 않는다", async () => {
	await initPosts();
	const generated = await generateMigration({ dir, schema: posts });
	// CLI-MGF-3.1
	expect(generated).toBeNull();
	// CLI-MGF-3.2
	expect(await listMigrationFiles(dir)).toEqual(["0001_init_posts.sql"]);
});

it("CLI-MGF-4 `--dry-run`으로 마이그레이션을 만들면 파일을 쓰지 않고 생성될 SQL만 돌려준다", async () => {
	const generated = await generateMigration({ dir, schema: posts, dryRun: true });
	// CLI-MGF-4.1
	expect(generated?.sql).toContain('create table "posts"');
	// CLI-MGF-4.2
	expect(await readdir(root, { recursive: true })).toEqual([]);
});
