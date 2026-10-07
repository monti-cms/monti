import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createCms } from "../../cms";
import { defineConfig } from "../../config/define";
import { docOfText } from "../../doc/__test__/doc-text";
import { postgres } from "../../server";
import type { CmsAuth } from "../../server/define";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "../../testing";

const auth = (): CmsAuth => ({
	basePath: "/api/cms/auth",
	handlers: { GET: async () => new Response(), POST: async () => new Response() },
	session: async () => ({ user: { id: "u", accountId: "u" } }),
	providers: [],
	signIn: async () => undefined,
	signOut: async () => undefined,
	isAdmin: () => true,
	devBypass: false,
	devUserId: "u",
});

const schema = {
	schemaVersion: 1,
	collections: {
		post: {
			label: "Post",
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", label: "Title", required: true },
				slug: { kind: "slug", label: "Address", from: "title" },
			},
			list: { columns: ["title", "status"] },
		},
	},
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
};

/** Renaming the title field through the schema settings API: the screen's rename keeps the title role on the renamed field, so the title stays the title. */
describe("renaming the title field", () => {
	let pool: Pool;
	let schemaName: string;
	let dir: string;
	let file: string;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		dir = mkdtempSync(path.join(tmpdir(), "monti-title-rename-"));
		file = path.join(dir, "monti.schema.json");
		writeFileSync(file, `${JSON.stringify(schema, null, "\t")}\n`);
	});

	afterEach(() => vi.unstubAllEnvs());

	afterAll(async () => {
		rmSync(dir, { recursive: true, force: true });
		await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const cms = () =>
		createCms({
			id: "title-rename",
			config: defineConfig({ schema: JSON.parse(readFileSync(file, "utf8")) }),
			schemaFile: file,
			server: {
				database: postgres({ connectionString: process.env.CMS_TEST_DATABASE_URL, schema: schemaName }),
				auth: { name: "test", create: auth },
				secret: "test-secret",
			},
		});
	const call = (instance: ReturnType<typeof cms>, method: string, route: string, body?: unknown) =>
		instance.handle(
			new Request(`http://localhost/api/cms/v1/${route}`, {
				method,
				headers: { "content-type": "application/json", "sec-fetch-site": "same-origin" },
				body: body === undefined ? undefined : JSON.stringify(body),
			}),
		);

	it("moves the stored titles, keeps the title role on the new name, and the list, sort and search follow", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const before = cms();
		await before.migrate({ log: () => undefined });
		for (const name of ["Pear", "Apple", "Mango"]) {
			await before.contentService().createDraft({
				collection: "post",
				slug: name.toLowerCase(),
				metadata: { title: name },
				doc: docOfText(`Body ${name}`),
			} as never);
		}
		const { hash, schema: current } = (await (await call(before, "GET", "schema")).json()) as {
			hash: string;
			schema: typeof schema;
		};

		// What the settings screen writes when the writer renames `title` to `headline`: the key moves, the title role is set on it, `slug.from` and the list columns follow.
		const edited = structuredClone(current);
		const { title, ...rest } = edited.collections.post.fields;
		edited.collections.post.fields = { headline: { ...title, role: "title" }, ...rest } as never;
		(edited.collections.post.fields.slug as { from: string }).from = "headline";
		edited.collections.post.list = { columns: ["headline", "status"] };
		const renames = [{ kind: "field", collection: "post", from: "title", to: "headline" }];

		const preview = await (await call(before, "POST", "schema/preview", { schema: edited, renames })).json();
		expect(preview).toMatchObject({ valid: true });
		expect(preview.decisions[0].chosen).toMatchObject({ op: "renameField", from: "title", to: "headline" });

		const res = await call(before, "PUT", "schema", { schema: edited, renames, baseHash: hash });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ saved: true, entriesRewritten: 3 });

		const onDisk = JSON.parse(readFileSync(file, "utf8"));
		expect(onDisk.collections.post.fields.headline).toMatchObject({ kind: "text", role: "title" });
		expect(onDisk.migrations[0]).toMatchObject({
			op: "renameField",
			collection: "post",
			from: "title",
			to: "headline",
		});

		const after = cms();
		expect(after.site.titleField("post").name).toBe("headline");
		const store = after.store();
		const sorted = await store.listEntries({
			collection: "post",
			sort: { field: "title", direction: "asc" },
			pageSize: 25,
		});
		expect(sorted.items.map((item) => item.title)).toEqual(["Apple", "Mango", "Pear"]);
		const found = await store.listEntries({ collection: "post", search: "man", pageSize: 25 });
		expect(found.items.map((item) => item.title)).toEqual(["Mango"]);
		const hits = await store.searchEntries({ collection: "post", query: "pe" });
		expect(hits.map((hit) => hit.title)).toEqual(["Pear"]);
	});

	it("tells the writer who forgot the title role: a schema with no title field is invalid", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const instance = cms();
		const { schema: current } = (await (await call(instance, "GET", "schema")).json()) as { schema: typeof schema };
		const edited = structuredClone(current);
		const fields = edited.collections.post.fields as Record<string, Record<string, unknown>>;
		const { role: _role, ...plain } = fields.headline as Record<string, unknown>;
		fields.headline = plain;
		const preview = await (await call(instance, "POST", "schema/preview", { schema: edited })).json();
		expect(preview.valid).toBe(false);
		expect(preview.issues[0].message).toContain("needs a title field");
	});
});
