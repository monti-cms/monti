import {
	createAdminApi,
	createMonti,
	createReader,
	type Database,
	type Doc,
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

/**
 * The small server the e2e tests and the usability driver run on, until a site can be mounted for real (T13): the real admin API on real Postgres.
 * `handle` answers what is the server's and returns `null` for what Vite serves (the admin's page).
 */
export async function startSite() {
	const db = await emptyDatabase(process.env.E2E_SCHEMA ?? E2E_SCHEMA_DEFAULT);
	const monti = createMonti({ db, schema, files: null, auth: { password: true }, secret: SECRET });
	await monti.run("auth.createFirstAdmin", { ...ADMIN, confirm: ADMIN.password }, { actor: "admin" });
	const api = createAdminApi(monti, { adminPath: "/" });
	const reader = createReader({ db, schema, secret: SECRET });

	async function sitePage(collection: string, slug: string): Promise<Response> {
		const found = await reader.entry({ collection, slug, locale: schema.locales.source });
		if (!found || !("entry" in found)) return new Response("not found", { status: 404 });
		const page = h(
			"main",
			null,
			h("h1", null, found.entry.title),
			...renderDocument((found.entry.doc ?? { type: "doc", blocks: [] }) as Doc, { createElement: h }),
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
