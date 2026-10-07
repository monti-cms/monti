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
	basePath: "/api/cms/auth",
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
		file = path.join(dir, "monti.schema.json");
	});

	afterAll(async () => {
		rmSync(dir, { recursive: true, force: true });
		for (const item of databases) await dropIsolatedTestPool(item.pool, item.schemaName);
		await closeGlobalPool();
	});

	afterEach(() => vi.unstubAllEnvs());

	const write = (value: unknown, indent: string | number = "\t") =>
		writeFileSync(file, `${JSON.stringify(value, null, indent)}\n`);
	const text = () => readFileSync(file, "utf8");
	const types = () => readFileSync(path.join(dir, "monti-env.d.ts"), "utf8");

	const newCms = (admin = true) =>
		createCms({
			id: `schema-edit-${++serial}`,
			config: defineConfig({ schema: JSON.parse(text()) }),
			schemaFile: file,
			server: {
				database: postgres({ connectionString: process.env.CMS_TEST_DATABASE_URL, schema: schemaName }),
				auth: { name: "test", create: () => auth(admin) },
				secret: "test-secret",
			},
		});

	const call = (cms: ReturnType<typeof newCms>, method: string, route: string, body?: unknown) =>
		cms.handle(
			new Request(`http://localhost/api/cms/v1/${route}`, {
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
			file: expect.stringContaining("monti.schema.json"),
		});
		expect(production.schema.collections.post.label).toBe("Post");

		vi.stubEnv("NODE_ENV", "development");
		expect(await (await call(cms, "GET", "schema")).json()).toMatchObject({ access: { writable: true } });
	});

	it("refuses to write outside development: 403 from both write routes, and the file is untouched", async () => {
		write(schemaOf({}));
		const before = text();
		const cms = newCms();
		const { hash, schema } = await read(cms);
		const edited = { ...schema, collections: { post: post({ summary: { kind: "text", label: "Summary" } }) } };

		const save = await call(cms, "PUT", "schema", { schema: edited, baseHash: hash });
		expect(save.status).toBe(403);
		expect(await save.json()).toMatchObject({ code: "schema_read_only", reason: "production" });
		const preview = await call(cms, "POST", "schema/preview", { schema: edited });
		expect(preview.status).toBe(403);
		expect(text()).toBe(before);
	});

	it("also refuses a signed-in user who is not an admin, in development", async () => {
		vi.stubEnv("NODE_ENV", "development");
		write(schemaOf({}));
		const cms = newCms(false);
		expect((await call(cms, "GET", "schema")).status).toBe(403);
		expect((await call(cms, "PUT", "schema", { schema: schemaOf({}), baseHash: "x" })).status).toBe(403);
	});

	it("adds a field through the API: it is in the file, in the types, and the running instance has it", async () => {
		vi.stubEnv("NODE_ENV", "development");
		await freshDatabase();
		// A hand-formatted array and a key order the save must keep.
		writeFileSync(
			file,
			`{\n\t"schemaVersion": 1,\n\t"collections": {\n\t\t"post": {\n\t\t\t"label": "Post",\n\t\t\t"kind": "document",\n\t\t\t"fields": {\n\t\t\t\t"title": { "kind": "text", "label": "Title", "required": true },\n\t\t\t\t"slug": { "kind": "slug", "label": "Address", "from": "title" }\n\t\t\t},\n\t\t\t"path": "/posts/:slug",\n\t\t\t"layout": [{ "fields": ["title", "slug"] }]\n\t\t}\n\t},\n\t"locales": [{ "code": "en", "name": "English" }],\n\t"defaultLocale": "en"\n}\n`,
		);
		const cms = newCms();
		const { hash, schema } = await read(cms);
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

		const onDisk = JSON.parse(text());
		expect(onDisk.collections.post.fields.rating.options).toEqual({ good: "Good", bad: "Bad" });
		expect(onDisk.schemaVersion).toBe(2);
		// Unchanged parts keep their text; the new field is written in the file's indentation.
		expect(text()).toContain(`"title": { "kind": "text", "label": "Title", "required": true },`);
		expect(text()).toContain(`"layout": [{ "fields": ["title", "slug"] }]`);
		expect(text()).toContain(`\t\t\t\t"rating": {\n\t\t\t\t\t"kind": "select"`);
		expect(Object.keys(onDisk.collections.post)).toEqual(["label", "kind", "fields", "path", "layout"]);
		// The generated types know the field.
		expect(types()).toContain("readonly rating:");
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
		const onDisk = JSON.parse(text());
		expect(onDisk.migrations).toHaveLength(1);
		expect(onDisk.migrations[0]).toMatchObject({
			op: "renameField",
			collection: "post",
			from: "summary",
			to: "excerpt",
		});
		expect(onDisk.schemaVersion).toBeGreaterThanOrEqual(2);
		expect(types()).toContain("readonly excerpt:");
		expect(types()).not.toContain("readonly summary:");
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
		expect(JSON.parse(text()).migrations.map((item: { op: string }) => item.op)).toEqual(["renameField", "dropField"]);
	});

	it("refuses a file that changed since the edit started", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const cms = newCms();
		const { hash, schema } = await read(cms);
		writeFileSync(file, `${text()}\n`);
		const before = text();
		const res = await call(cms, "PUT", "schema", { schema, baseHash: hash });
		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ code: "schema_conflict" });
		expect(text()).toBe(before);
	});

	it("reports what is wrong with the JSON path, and writes nothing", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const cms = newCms();
		const { hash, schema } = await read(cms);
		const before = text();
		const edited = structuredClone(schema) as { collections: { post: { fields: Record<string, unknown> } } };
		edited.collections.post.fields.broken = { kind: "text", label: "Broken", max: 0 };
		const res = await call(cms, "PUT", "schema", { schema: edited, baseHash: hash });
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.code).toBe("invalid_schema");
		expect(body.issues).toEqual(
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

	it("runs a schema file edited by hand, without a restart", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const cms = newCms();
		expect(Object.keys(cms.site.config.collections.post?.fields ?? {})).not.toContain("handmade");
		const current = JSON.parse(text());
		current.collections.post.fields.handmade = { kind: "text", label: "Hand made" };
		writeFileSync(file, `${JSON.stringify(current, null, "\t")}\n`);
		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(Object.keys(cms.site.config.collections.post?.fields ?? {})).toContain("handmade");
		// A half-written file leaves the running schema as it was.
		const report = vi.spyOn(console, "error").mockImplementation(() => undefined);
		writeFileSync(file, "{ not json");
		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(Object.keys(cms.site.config.collections.post?.fields ?? {})).toContain("handmade");
		expect(report).toHaveBeenCalledWith(expect.stringContaining("the schema file was not reloaded"));
		report.mockRestore();
	});

	it("does not reload in production", async () => {
		write(schemaOf({}));
		const cms = newCms();
		expect(cms.reloadSchema()).toEqual({ reloaded: false, reason: "production" });
	});
});
