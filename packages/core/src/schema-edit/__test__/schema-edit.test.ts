import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createCms } from "../../cms";
import { defineSite } from "../../config/define";
import { docOfText } from "../../doc/__test__/doc-text";
import { parseSchemaLiteral } from "../../schema-file/literal";
import { loadSchemaFile } from "../../schema-file/locate";
import { printSchemaFile } from "../../schema-file/print";
import type { SchemaTypes } from "../../schema-file/types";
import { postgres } from "../../server";
import type { CmsAuth } from "../../server/define";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "../../testing";

const post = (fields: Record<string, unknown>) => ({
	label: "Post",
	kind: "document",
	path: "/posts/:slug",
	fields: {
		title: { kind: "text", label: "Title", required: true },
		slug: { kind: "slug", label: "Address", from: "title" },
		...fields,
	},
});

const schemaOf = (fields: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
	schemaVersion: 1,
	collections: { post: post(fields) },
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
	...extra,
});

/** A login connection that knows one user. `admin: false` makes it a signed-in user who is not an admin. */
const auth = (admin: boolean): CmsAuth => ({
	basePath: "/api/monti/auth",
	handlers: { GET: async () => new Response(), POST: async () => new Response() },
	session: async () => ({ user: { id: "u", accountId: "u" } }),
	providers: [],
	signIn: async () => undefined,
	signOut: async () => undefined,
	isAdmin: () => admin,
	devBypass: false,
	devUserId: "u",
});

/**
 * The settings screen's API against a real database and a schema file in a folder: the server that writes the file in development and refuses to write it
 * anywhere else, a field added through the API ending up in the file and in the types, a rename that moves the stored values, and the entries a change touches.
 */
describe("schema settings API", () => {
	let pool: Pool;
	let schemaName: string;
	let dir: string;
	let file: string;
	let serial = 0;

	const databases: { pool: Pool; schemaName: string }[] = [];
	/** A database with no schema recorded as applied: what a test that starts from a file of its own needs. */
	const freshDatabase = async () => {
		const isolated = await createIsolatedTestPool();
		databases.push(isolated);
		pool = isolated.pool;
		schemaName = isolated.schemaName;
	};

	beforeAll(async () => {
		await freshDatabase();
		dir = mkdtempSync(path.join(tmpdir(), "monti-schema-edit-"));
		file = path.join(dir, "monti.schema.ts");
	});

	afterAll(async () => {
		rmSync(dir, { recursive: true, force: true });
		for (const item of databases) await dropIsolatedTestPool(item.pool, item.schemaName);
		await closeGlobalPool();
	});

	afterEach(() => vi.unstubAllEnvs());

	const write = (value: Record<string, unknown>) => writeFileSync(file, printSchemaFile(value));
	const text = () => readFileSync(file, "utf8");
	/** The data in the file, read as text (the file is a pure literal). */
	// biome-ignore lint/suspicious/noExplicitAny: a test reads any part of the data
	const onDiskData = (): Record<string, any> => {
		const literal = parseSchemaLiteral(text());
		if (!literal.ok) throw new Error(literal.message);
		return literal.value;
	};

	const newCms = (admin = true) =>
		createCms({
			id: `schema-edit-${++serial}`,
			config: defineSite({ schema: onDiskData() as SchemaTypes }),
			schemaFile: file,
			server: {
				database: postgres({ connectionString: process.env.CMS_TEST_DATABASE_URL, schema: schemaName }),
				auth: { name: "test", create: () => auth(admin) },
				secret: "test-secret",
			},
		});

	const call = (cms: ReturnType<typeof newCms>, method: string, route: string, body?: unknown) =>
		cms.handle(
			new Request(`http://localhost/api/monti/v1/${route}`, {
				method,
				headers: { "content-type": "application/json", "sec-fetch-site": "same-origin" },
				body: body === undefined ? undefined : JSON.stringify(body),
			}),
		);
	const read = async (cms: ReturnType<typeof newCms>) =>
		(await (await call(cms, "GET", "schema")).json()) as { hash: string; schema: Record<string, unknown> };
	const metadataOf = async (slug: string) =>
		(
			await pool.query<{ metadata: Record<string, unknown> }>(
				`SELECT b.metadata FROM "${schemaName}".entry_bodies b JOIN "${schemaName}".entries e ON e.id = b.entry_id WHERE e.working_slug = $1 AND b.state = 'working'`,
				[slug],
			)
		).rows[0]?.metadata;

	it("reads the file in any mode, and says whether it can be written", async () => {
		write(schemaOf({}));
		const cms = newCms();
		const production = await (await call(cms, "GET", "schema")).json();
		expect(production).toMatchObject({
			access: { writable: false, reason: "production" },
			source: "file",
			file: expect.stringContaining("monti.schema.ts"),
		});
		expect(production.schema.collections.post.label).toBe("Post");

		vi.stubEnv("NODE_ENV", "development");
		expect(await (await call(cms, "GET", "schema")).json()).toMatchObject({ access: { writable: true } });
	});

	it("says where the site URL comes from, and that it is not set when no one set it", async () => {
		write(schemaOf({}));
		const withUrl = (siteUrlSource: string | undefined, url: string | undefined) =>
			createCms({
				id: `schema-edit-${++serial}`,
				config: defineSite({ schema: onDiskData() as SchemaTypes, ...(url ? { site: { url } } : {}) }),
				schemaFile: file,
				...(siteUrlSource ? { siteUrlSource } : {}),
				server: {
					database: postgres({ connectionString: process.env.CMS_TEST_DATABASE_URL, schema: schemaName }),
					auth: { name: "test", create: () => auth(true) },
					secret: "test-secret",
				},
			});
		const urlOf = async (cms: ReturnType<typeof newCms>) =>
			((await (await call(cms, "GET", "schema")).json()) as { siteUrl: unknown }).siteUrl;
		expect(await urlOf(withUrl(undefined, undefined))).toEqual({ url: null, from: "none" });
		expect(await urlOf(withUrl("from env SITE_URL", "https://a.example"))).toEqual({
			url: "https://a.example",
			from: "env",
		});
		expect(await urlOf(withUrl("set in the schema file (site.url)", "https://b.example"))).toEqual({
			url: "https://b.example",
			from: "schema",
		});
		expect(await urlOf(withUrl("set in monti.config.ts (site.url)", "https://c.example"))).toEqual({
			url: "https://c.example",
			from: "config",
		});
	});

	it("refuses to write outside development: 403 from both write routes, and the file is untouched", async () => {
		write(schemaOf({}));
		const before = text();
		const cms = newCms();
		const { hash, schema } = await read(cms);
		const edited = { ...schema, collections: { post: post({ summary: { kind: "text", label: "Summary" } }) } };

		const save = await call(cms, "PUT", "schema", { schema: edited, baseHash: hash });
		expect(save.status).toBe(403);
		expect(await save.json()).toMatchObject({ error: { code: "schema_read_only", details: { reason: "production" } } });
		const preview = await call(cms, "POST", "schema/preview", { schema: edited });
		expect(preview.status).toBe(403);
		expect(text()).toBe(before);
	});

	it("refuses to write on a server that runs in development mode but looks deployed", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("VERCEL", "1");
		write(schemaOf({}));
		const before = text();
		const cms = newCms();
		const { hash, schema } = await read(cms);
		const res = await call(cms, "PUT", "schema", { schema, baseHash: hash });
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ error: { code: "schema_read_only", details: { reason: "production" } } });
		expect(text()).toBe(before);
	});

	it("also refuses a signed-in user who is not an admin, in development", async () => {
		vi.stubEnv("NODE_ENV", "development");
		write(schemaOf({}));
		const cms = newCms(false);
		expect((await call(cms, "GET", "schema")).status).toBe(403);
		expect((await call(cms, "PUT", "schema", { schema: schemaOf({}), baseHash: "x" })).status).toBe(403);
	});

	it("adds a field through the API: the whole file is printed again, a later load sees the field, and the running instance has it", async () => {
		vi.stubEnv("NODE_ENV", "development");
		await freshDatabase();
		// A hand-formatted file with comments: saving writes it again in the printer's form, in the key order of the data.
		writeFileSync(
			file,
			`// my schema\nimport { defineSchema } from '@monti-cms/core'\n\nexport default defineSchema({\n\tschemaVersion: 1,\n\tcollections: {\n\t\tpost: {\n\t\t\tlabel: 'Post', kind: 'document',\n\t\t\tfields: {\n\t\t\t\ttitle: { kind: 'text', label: 'Title', required: true },\n\t\t\t\tslug: { kind: 'slug', label: 'Address', from: 'title' },\n\t\t\t},\n\t\t\tpath: '/posts/:slug',\n\t\t\tlayout: [{ fields: ['title', 'slug'] }],\n\t\t},\n\t},\n\tlocales: [{ code: 'en', name: 'English' }],\n\tdefaultLocale: 'en',\n})\n`,
		);
		const cms = newCms();
		const state = await (await call(cms, "GET", "schema")).json();
		expect(state).toMatchObject({ access: { writable: true }, source: "file", comments: true });
		const { hash, schema } = state;
		const edited = structuredClone(schema) as { collections: { post: { fields: Record<string, unknown> } } };
		edited.collections.post.fields.rating = {
			kind: "select",
			label: "Rating",
			options: { good: "Good", bad: "Bad" },
			defaultValue: "good",
		};

		const preview = await (await call(cms, "POST", "schema/preview", { schema: edited })).json();
		expect(preview).toMatchObject({ valid: true, changed: true });
		expect(preview.impacts.map((item: { change: { kind: string } }) => item.change.kind)).toContain("field_added");

		const res = await call(cms, "PUT", "schema", { schema: edited, baseHash: hash });
		expect(res.status).toBe(200);
		const saved = await res.json();
		expect(saved).toMatchObject({ saved: true, reloaded: true, schemaVersion: 2 });

		// The file is the printer's output for the saved data, with the new field in place and the version raised.
		const onDisk = onDiskData();
		expect(text()).toBe(printSchemaFile(onDisk));
		expect(text()).not.toContain("// my schema");
		expect(text()).toContain('\t\t\t\trating: {\n\t\t\t\t\tkind: "select",');
		expect(onDisk.collections.post.fields.rating.options).toEqual({ good: "Good", bad: "Bad" });
		expect(onDisk.schemaVersion).toBe(2);
		expect(Object.keys(onDisk)).toEqual(["schemaVersion", "collections", "locales", "defaultLocale"]);
		expect(Object.keys(onDisk.collections.post)).toEqual(["label", "kind", "fields", "path", "layout"]);
		// A later load of the module sees the change.
		const loaded = await loadSchemaFile(dir, file, { fresh: true });
		expect(Object.keys(loaded.collections.post?.fields ?? {})).toEqual(["title", "slug", "rating"]);
		expect(loaded.schemaVersion).toBe(2);
		// The instance runs the new schema without a restart.
		expect(Object.keys(cms.site.config.collections.post?.fields ?? {})).toContain("rating");
	});

	it("shows the entries a change touches, with a sample, before anything is saved", async () => {
		vi.stubEnv("NODE_ENV", "development");
		await freshDatabase();
		write(schemaOf({ summary: { kind: "text", label: "Summary" } }));
		const cms = newCms();
		await cms.migrate({ log: () => {} });
		for (const [slug, summary] of [
			["one", "First"],
			["two", "Second"],
			["three", undefined],
		] as const) {
			await cms.contentService().createDraft({
				collection: "post",
				slug,
				metadata: { title: slug, ...(summary ? { summary } : {}) },
				doc: docOfText(`Body ${slug}`),
			} as never);
		}
		const { schema } = await read(cms);
		const edited = structuredClone(schema) as { collections: { post: { fields: Record<string, unknown> } } };
		delete edited.collections.post.fields.summary;

		const preview = await (await call(cms, "POST", "schema/preview", { schema: edited })).json();
		const removed = preview.impacts.find((item: { change: { kind: string } }) => item.change.kind === "field_removed");
		expect(removed).toMatchObject({ entries: 2, consequence: "orphaned", checked: true });
		expect(removed.sample.map((item: { title: string }) => item.title).sort()).toEqual(["one", "two"]);
		expect(removed.sample[0]).toMatchObject({ collection: "post", locale: "en", status: "draft" });
		// The writer is asked: a drop that would delete values is not picked for them.
		expect(preview.decisions).toHaveLength(1);
		expect(preview.decisions[0]).toMatchObject({ entries: 2, chosen: null });
		expect(preview.decisions[0].suggestions.map((item: { op: string }) => item.op)).toEqual(["dropField"]);
		expect(preview.transforms).toEqual([]);
	});

	it("renames a field with a transform: the stored values move, the transform is recorded, the file and version follow", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const cms = newCms();
		const { hash, schema } = await read(cms);
		const edited = structuredClone(schema) as { collections: { post: { fields: Record<string, unknown> } } };
		const { summary, ...rest } = edited.collections.post.fields;
		edited.collections.post.fields = { ...rest, excerpt: summary };
		const renames = [{ kind: "field", collection: "post", from: "summary", to: "excerpt" }];

		const preview = await (await call(cms, "POST", "schema/preview", { schema: edited, renames })).json();
		// A rename the screen made is offered as a rename and is what is picked.
		expect(preview.decisions[0].suggestions[0]).toMatchObject({ op: "renameField", from: "summary", to: "excerpt" });
		expect(preview.decisions[0].chosen).toMatchObject({ op: "renameField" });
		expect(preview.transforms).toHaveLength(1);

		const res = await call(cms, "PUT", "schema", { schema: edited, renames, baseHash: hash });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ saved: true, entriesRewritten: 2 });

		expect(await metadataOf("one")).toEqual({ title: "one", excerpt: "First" });
		expect(await metadataOf("three")).toEqual({ title: "three" });
		const onDisk = onDiskData();
		expect(onDisk.migrations).toHaveLength(1);
		expect(onDisk.migrations[0]).toMatchObject({
			op: "renameField",
			collection: "post",
			from: "summary",
			to: "excerpt",
		});
		expect(onDisk.schemaVersion).toBeGreaterThanOrEqual(2);
		expect(Object.keys(onDisk.collections.post.fields)).toContain("excerpt");
		expect(Object.keys(onDisk.collections.post.fields)).not.toContain("summary");
	});

	it("lets the writer pick a transform: dropping a field deletes its values only when picked", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const cms = newCms();
		const { hash, schema } = await read(cms);
		const edited = structuredClone(schema) as { collections: { post: { fields: Record<string, unknown> } } };
		delete edited.collections.post.fields.excerpt;
		const drop = { op: "dropField", collection: "post", field: "excerpt" };

		const res = await call(cms, "PUT", "schema", { schema: edited, transforms: [drop], baseHash: hash });
		expect(res.status).toBe(200);
		expect(await metadataOf("one")).toEqual({ title: "one" });
		expect(onDiskData().migrations.map((item: { op: string }) => item.op)).toEqual(["renameField", "dropField"]);
	});

	it("refuses a file that changed since the edit started", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const cms = newCms();
		const { hash, schema } = await read(cms);
		writeFileSync(file, `${text()}\n`);
		const before = text();
		const res = await call(cms, "PUT", "schema", { schema, baseHash: hash });
		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ error: { code: "schema_conflict" } });
		expect(text()).toBe(before);
	});

	it("reports what is wrong with the path of the value, and writes nothing", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const cms = newCms();
		const { hash, schema } = await read(cms);
		const before = text();
		const edited = structuredClone(schema) as { collections: { post: { fields: Record<string, unknown> } } };
		edited.collections.post.fields.broken = { kind: "text", label: "Broken", max: 0 };
		const res = await call(cms, "PUT", "schema", { schema: edited, baseHash: hash });
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error.code).toBe("invalid_schema");
		expect(body.error.issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ path: "collections.post.fields.broken.max" })]),
		);
		// A rule between collections is reported too, with the collection's path.
		const relation = structuredClone(schema) as { collections: { post: { fields: Record<string, unknown> } } };
		relation.collections.post.fields.about = { kind: "relation", label: "About", to: "nowhere" };
		const preview = await (await call(cms, "POST", "schema/preview", { schema: relation })).json();
		expect(preview.valid).toBe(false);
		expect(preview.issues[0].message).toContain("nowhere");
		expect(text()).toBe(before);
	});

	it("is read-only when the file holds code: the screen says why, both write routes answer 403, and the file is untouched", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const withSpread = printSchemaFile(schemaOf({})).replace(
			"export default defineSchema({\n",
			"const base = { schemaVersion: 1 };\n\nexport default defineSchema({\n\t...base,\n",
		);
		write(schemaOf({}));
		const cms = newCms();
		writeFileSync(file, withSpread);
		const state = await (await call(cms, "GET", "schema")).json();
		expect(state).toMatchObject({
			access: { writable: false, reason: "has_code", detail: expect.stringContaining("line 3") },
			source: "site",
		});
		// The screen still shows what the instance runs.
		expect(state.schema.collections.post.label).toBe("Post");
		const save = await call(cms, "PUT", "schema", { schema: state.schema, baseHash: state.hash });
		expect(save.status).toBe(403);
		expect(await save.json()).toMatchObject({
			error: {
				code: "schema_read_only",
				details: { reason: "has_code" },
				message: "monti.schema.ts contains code, so the admin cannot rewrite it; edit the file instead",
			},
		});
		expect((await call(cms, "POST", "schema/preview", { schema: state.schema })).status).toBe(403);
		expect(text()).toBe(withSpread);
	});

	it("does not reload in production", async () => {
		write(schemaOf({}));
		const cms = newCms();
		expect(cms.reloadSchema(schemaOf({}))).toEqual({ reloaded: false, reason: "production" });
	});

	it("reloads the instance in place with the schema it is given, and keeps the last good one for a schema that does not check", async () => {
		vi.stubEnv("NODE_ENV", "development");
		write(schemaOf({}));
		const cms = newCms();
		expect(cms.reloadSchema(schemaOf({ handmade: { kind: "text", label: "Hand made" } }))).toEqual({ reloaded: true });
		expect(Object.keys(cms.site.config.collections.post?.fields ?? {})).toContain("handmade");
		const report = vi.spyOn(console, "error").mockImplementation(() => undefined);
		expect(cms.reloadSchema({ nope: true })).toMatchObject({ reloaded: false });
		expect(Object.keys(cms.site.config.collections.post?.fields ?? {})).toContain("handmade");
		expect(report).toHaveBeenCalledWith(expect.stringContaining("the schema was not reloaded"));
		report.mockRestore();
	});
});
