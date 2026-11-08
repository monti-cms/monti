import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	createAdminApi,
	createMonti,
	createReader,
	type Database,
	type Doc,
	definePlugin,
	localFolderStorage,
	migrateContent,
	migrateToLatest,
} from "@monti-cms/core";
import { type CreateElement, renderDocument } from "@monti-cms/core/render";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { createElement, type ElementType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { schema } from "../../packages/admin/src/screens/story-schema";
import { ADMIN, E2E_SCHEMA_DEFAULT } from "./account";

const SECRET = "e2e secret";

/** React's `createElement` in the shape the core's drawing asks for: the core knows no framework (doc 03). */
const h: CreateElement<ReactNode> = (type, props, ...children) =>
	createElement(type as ElementType, props, ...(children as ReactNode[]));

function databaseUrl() {
	const url = process.env.CMS_TEST_DATABASE_URL;
	if (!url) throw new Error("Set CMS_TEST_DATABASE_URL (postgres://localhost/monti_test) to run the e2e tests.");
	return url;
}

/** Empties the schema and makes the tables, so every run starts from nothing (docs/testing.md, L5). */
async function emptyDatabase(name: string): Promise<Kysely<Database>> {
	if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`"${name}" is no schema name.`);
	const owner = new Pool({ connectionString: databaseUrl(), max: 1 });
	await owner.query(`drop schema if exists ${name} cascade`);
	await owner.query(`create schema ${name}`);
	await owner.end();
	const db = new Kysely<Database>({
		dialect: new PostgresDialect({
			pool: new Pool({ connectionString: databaseUrl(), options: `-c search_path=${name}` }),
		}),
	});
	await migrateToLatest(db);
	await migrateContent(db, schema, []);
	return db;
}

/** A little to start from, for the usability test: names as a person would have them, a folder, and entries to put pictures in. It goes through the same operations. */
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

/**
 * The small server the e2e tests and the usability driver run on, until a site can be mounted for real (T13): the real admin API on real Postgres.
 * `handle` answers what is the server's and returns `null` for what Vite serves (the admin's page).
 */
export async function startSite() {
	const db = await emptyDatabase(process.env.E2E_SCHEMA ?? E2E_SCHEMA_DEFAULT);
	// Files on real disk in a folder of this run; `E2E_STORAGE=off` is a site with no storage (flow 6·31).
	const plugins =
		process.env.E2E_STORAGE === "off"
			? []
			: [
					definePlugin({
						name: "e2e-files",
						storage: localFolderStorage({ dir: await mkdtemp(path.join(tmpdir(), "monti-e2e-")) }),
					}),
				];
	const monti = createMonti({ db, schema, files: null, auth: { password: true }, secret: SECRET, plugins });
	await monti.run("auth.createFirstAdmin", { ...ADMIN, confirm: ADMIN.password }, { actor: "admin" });
	if (process.env.E2E_SEED === "1") await seed(monti);
	const api = createAdminApi(monti, { adminPath: "/" });
	const reader = createReader({ db, schema, secret: SECRET, storage: monti.site.storage });

	async function sitePage(collection: string, slug: string): Promise<Response> {
		const found = await reader.entry({ collection, slug, locale: schema.locales.source });
		if (!found || !("entry" in found)) return new Response("not found", { status: 404 });
		const page = h(
			"main",
			null,
			h("h1", null, found.entry.title),
			...renderDocument((found.entry.doc ?? { type: "doc", blocks: [] }) as Doc, {
				createElement: h,
				mediaUrl: (id) => found.entry.media?.[id]?.url ?? id,
				mediaSize: (id) => found.entry.media?.[id],
				mediaName: (id) => found.entry.media?.[id]?.name,
			}),
		);
		return new Response(`<!doctype html>${renderToStaticMarkup(page)}`, {
			headers: { "content-type": "text/html; charset=utf-8" },
		});
	}

	return {
		async handle(request: Request): Promise<Response | null> {
			const { pathname } = new URL(request.url);
			if (pathname.startsWith("/admin/api/")) return api(request);
			const site = pathname.match(/^\/site\/([^/]+)\/([^/]+)$/);
			if (site) return sitePage(decodeURIComponent(site[1] ?? ""), decodeURIComponent(site[2] ?? ""));
			return null;
		},
	};
}
