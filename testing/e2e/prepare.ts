// Gets the example app ready for the flow tests (docs/testing.md, L5): empty databases with the site's tables and one admin, the admin's
// stylesheet, and the app built as a live site. `pnpm test:e2e` runs this first; the servers Playwright starts only serve what is made here.
//
//   tsx testing/e2e/prepare.ts            the databases of every server, the stylesheet and the build
//   tsx testing/e2e/prepare.ts --seed monti_usability 4173
//                                         one database with a little to start from, the app built and started on the port (the usability test)
import { execFileSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMonti, type Database, migrateContent, migrateToLatest } from "@monti-cms/core";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import schema from "../../examples/blog/monti.schema";
import { ADMIN, databaseOf, SERVERS, testDatabase } from "./servers";

const root = fileURLToPath(new URL("../..", import.meta.url));
const app = path.join(root, "examples", "blog");

/** Empties the schema and makes the tables, so every run starts from nothing. */
async function emptyDatabase(name: string): Promise<Kysely<Database>> {
	if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`"${name}" is no schema name.`);
	const owner = new Pool({ connectionString: testDatabase(), max: 1 });
	await owner.query(`drop schema if exists ${name} cascade`);
	await owner.query(`create schema ${name}`);
	await owner.end();
	const db = new Kysely<Database>({
		dialect: new PostgresDialect({ pool: new Pool({ connectionString: databaseOf(name) }) }),
	});
	await migrateToLatest(db);
	await migrateContent(db, schema, []);
	return db;
}

/** A little to start from, for the usability test: names as a person would have them, a folder, and entries to put pictures in. */
async function seed(monti: ReturnType<typeof createMonti>) {
	const admin = { actor: "admin" } as const;
	await monti.run(
		"collections.updateAdminValues",
		{
			collection: "post",
			values: { label: "게시글", fields: { cover: { label: "대표 이미지" }, summary: { label: "요약" } } },
		},
		admin,
	);
	await monti.run("collections.updateAdminValues", { collection: "memo", values: { label: "메모" } }, admin);
	await monti.run("collections.updateAdminValues", { collection: "category", values: { label: "카테고리" } }, admin);
	await monti.run("folders.create", { scope: "media", parentId: null, name: "covers" }, admin);
	await monti.run("folders.create", { scope: "media", parentId: null, name: "Blog Assets" }, admin);
	const paragraph = (id: string, text: string) => ({ id, type: "paragraph", content: [{ type: "text", text }] });
	const made = (await monti.run(
		"entries.create",
		{
			collection: "post",
			locale: "ko",
			title: "아침의 책상",
			slug: "morning-desk",
			doc: {
				type: "doc",
				blocks: [
					paragraph("p1", "블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다."),
					{
						id: "l1",
						type: "bulletList",
						children: [{ id: "li1", type: "listItem", content: [{ type: "text", text: "덜어낸 것" }] }],
					},
					paragraph("p2", "편집기도 같은 원칙으로 정리했다."),
				],
			},
		},
		admin,
	)) as { output: { id: string } };
	await monti.run("entries.publish", { ids: [made.output.id] }, admin);
	await monti.run(
		"entries.create",
		{ collection: "post", locale: "ko", title: "두 번째 글", slug: "second-post" },
		admin,
	);
}

async function database(name: string, seeded: boolean) {
	const db = await emptyDatabase(name);
	const monti = createMonti({ db, schema, files: null, auth: { password: true } });
	await monti.run("auth.createFirstAdmin", { ...ADMIN, confirm: ADMIN.password }, { actor: "admin" });
	if (seeded) await seed(monti);
	await db.destroy();
}

const run = (command: string, args: string[], env: Record<string, string> = {}) =>
	execFileSync(command, args, { cwd: app, stdio: "inherit", env: { ...process.env, ...env } });

const styles = () =>
	// The admin's stylesheet is a built file (`@monti-cms/admin/styles.css`).
	execFileSync("pnpm", ["--filter", "@monti-cms/admin", "build:styles"], { cwd: root, stdio: "inherit" });

const seedAt = process.argv.indexOf("--seed");
if (seedAt > 0) {
	// The usability test's server: one seeded database, and the app built and started as a live site on the port given (structure is locked, so a
	// run cannot rewrite the example's schema file).
	const [name = "", port = "4173"] = process.argv.slice(seedAt + 1);
	await database(name, true);
	styles();
	const env = {
		DATABASE_URL: databaseOf(name),
		MONTI_SECRET: "usability secret",
		MONTI_FILES: path.join(tmpdir(), `monti-files-${name}`),
		NEXT_DIST_DIR: `.next-${name}`,
	};
	rmSync(env.MONTI_FILES, { recursive: true, force: true });
	run("pnpm", ["exec", "next", "build"], env);
	run("pnpm", ["exec", "next", "start", "--port", port], env);
} else {
	for (const server of SERVERS) {
		await database(server.schema, false);
		rmSync(server.env.MONTI_FILES ?? "", { recursive: true, force: true });
	}
	styles();
	// Built once as a live site, against the first server's database; the other live server takes a copy, so each keeps its own cached pages.
	const [first, ...rest] = SERVERS.filter((server) => server.mode === "start");
	if (!first) throw new Error("no live server to build for");
	rmSync(path.join(app, first.dist), { recursive: true, force: true });
	run("pnpm", ["exec", "next", "build"], { ...first.env, NEXT_DIST_DIR: first.dist });
	for (const server of rest) {
		rmSync(path.join(app, server.dist), { recursive: true, force: true });
		cpSync(path.join(app, first.dist), path.join(app, server.dist), { recursive: true });
	}
}
