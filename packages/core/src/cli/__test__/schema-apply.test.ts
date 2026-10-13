import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCms } from "../../cms";
import { defineSite } from "../../config/define";
import { docOfText } from "../../doc/__test__/doc-text";
import { loadSchemaFile } from "../../schema-file/locate";
import { printSchemaFile } from "../../schema-file/print";
import type { SchemaFile } from "../../schema-file/types";
import { postgres } from "../../server";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "../../testing";
import { runCli } from "../index";
import { schemaApply, schemaDiff, withSchemaVersion } from "../schema-apply";

describe("withSchemaVersion", () => {
	it("replaces the number and leaves the rest of the file as it is", () => {
		const text = "export default defineSchema({\n\t// keep me\n\tschemaVersion: 3,\n\tcollections: {},\n});\n";
		expect(withSchemaVersion(text, 4)).toBe(
			"export default defineSchema({\n\t// keep me\n\tschemaVersion: 4,\n\tcollections: {},\n});\n",
		);
	});

	it("changes the version of the schema itself, not text that only looks like it", () => {
		const text = [
			"// schemaVersion: 1 was the first one",
			"export default defineSchema({",
			"\tcollections: {",
			'\t\tpost: { label: "Post", note: "schemaVersion: 3, raised often", nested: { schemaVersion: 7 } },',
			"\t},",
			"\tschemaVersion: 3,",
			"});",
			"",
		].join("\n");
		const result = withSchemaVersion(text, 4);
		expect(result).toBe(text.replace("\tschemaVersion: 3,", "\tschemaVersion: 4,"));
	});

	it("adds the line when the number only appears in a note", () => {
		const text = 'export default defineSchema({\n\tcollections: { post: { note: "schemaVersion: 3" } },\n});\n';
		expect(withSchemaVersion(text, 2)).toBe(
			`export default defineSchema({\n\tschemaVersion: 2,\n${text.split("\n").slice(1).join("\n")}`,
		);
	});

	it("adds the line first in the object, in the file's indentation", () => {
		expect(withSchemaVersion("export default defineSchema({\n  collections: {},\n});\n", 2)).toBe(
			"export default defineSchema({\n  schemaVersion: 2,\n  collections: {},\n});\n",
		);
		expect(withSchemaVersion("export default defineSchema({\n\tcollections: {},\n});\n", 2)).toBe(
			"export default defineSchema({\n\tschemaVersion: 2,\n\tcollections: {},\n});\n",
		);
		expect(() => withSchemaVersion("export default 1;\n", 2)).toThrow(/defineSchema/);
	});
});

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

const schema = (fields: Record<string, unknown>, extra: Partial<SchemaFile> = {}): string =>
	printSchemaFile({
		schemaVersion: 1,
		collections: { post: post(fields) },
		locales: [{ code: "en", name: "English" }],
		defaultLocale: "en",
		...extra,
	});

/** The `monti schema:diff` and `monti schema:apply` commands, end to end: a schema file in a folder, a real database, a CMS instance built from the file on every run. */
describe("schema:diff and schema:apply", () => {
	let pool: Pool;
	let schemaName: string;
	let dir: string;
	let file: string;
	let serial = 0;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		dir = mkdtempSync(path.join(tmpdir(), "monti-schema-"));
		file = path.join(dir, "monti.schema.ts");
	});

	afterAll(async () => {
		rmSync(dir, { recursive: true, force: true });
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	/** A CMS instance for the schema file as it is now, like `monti` loading the server file anew on each run. */
	const loadCms = async () =>
		createCms({
			id: `schema-apply-${++serial}`,
			config: defineSite({ schema: await loadSchemaFile(dir, file, { fresh: true }) }),
			server: {
				database: postgres({ connectionString: process.env.CMS_TEST_DATABASE_URL, schema: schemaName }),
				auth: { name: "test", create: () => ({}) as never },
				secret: "test-secret",
			},
		});
	const options = () => ({ cwd: dir, envFiles: [] as string[], log: () => {}, error: () => {}, loadCms });
	const fileText = () => readFileSync(file, "utf8");
	const metadataOf = async (slug: string) => {
		const res = await pool.query<{ metadata: Record<string, unknown>; schema_version: number }>(
			`SELECT b.metadata, b.schema_version FROM "${schemaName}".entry_bodies b JOIN "${schemaName}".entries e ON e.id = b.entry_id
			 WHERE e.working_slug = $1 AND b.state = 'working'`,
			[slug],
		);
		return res.rows[0];
	};

	it("starts with a baseline that changes nothing, and writes nothing to the file", async () => {
		writeFileSync(file, schema({ summary: { kind: "text", label: "Summary" } }));
		const before = fileText();
		const outcome = await schemaApply(options());
		expect(outcome.ok).toBe(true);
		expect(outcome.text).toContain("No schema has been applied to this store yet");
		expect(outcome.text).toContain("No transform to run. Recorded the schema at version 1");
		expect(fileText()).toBe(before);
	});

	it("shows what a change touches before it is applied", async () => {
		const cms = await loadCms();
		for (const [slug, summary] of [
			["one", "First"],
			["two", "Second"],
		] as const) {
			await cms.contentService().createDraft({
				collection: "post",
				slug,
				metadata: { title: slug, summary },
				doc: docOfText(`Body ${slug}`),
			} as never);
		}
		await cms.close();

		writeFileSync(
			file,
			schema(
				{ excerpt: { kind: "text", label: "Excerpt" } },
				{
					migrations: [{ id: "rename-summary", op: "renameField", collection: "post", from: "summary", to: "excerpt" }],
				},
			),
		);
		const diff = await schemaDiff(options());
		expect(diff.exitCode).toBe(0);
		expect(diff.text).toContain("Applied schema version: 1. After the apply: 2.");
		expect(diff.text).toContain("post.summary renamed to excerpt [transform rename-summary]: 2 entries");
		expect(diff.text).toContain("Transforms to run (1): rename-summary");
		expect((await schemaDiff({ ...options(), check: true })).exitCode).toBe(1);
		expect((await metadataOf("one"))?.metadata).toMatchObject({ summary: "First" });
	});

	it("a dry run reports and changes nothing, not even the file", async () => {
		const before = fileText();
		const outcome = await schemaApply({ ...options(), dryRun: true });
		expect(outcome.ok).toBe(true);
		expect(outcome.text).toContain("Ran rename-summary: 2 entries");
		expect(outcome.text).toContain("Dry run: nothing was changed.");
		expect(fileText()).toBe(before);
		expect((await metadataOf("one"))?.metadata).toMatchObject({ summary: "First" });
	});

	it("applies the transforms, raises schemaVersion in the file, and stamps the transformed entries", async () => {
		const outcome = await schemaApply(options());
		expect(outcome.ok).toBe(true);
		expect(outcome.text).toContain("Ran rename-summary: 2 entries");
		expect(outcome.text).toContain("Raised schemaVersion in");
		expect((await loadSchemaFile(dir, file, { fresh: true })).schemaVersion).toBe(2);
		// The rest of the file keeps its formatting.
		expect(fileText()).toContain("\tschemaVersion: 2,\n\tcollections: {");
		const one = await metadataOf("one");
		expect(one?.metadata).toEqual({ title: "one", excerpt: "First" });
		expect(one?.schema_version).toBe(2);
	});

	it("is idempotent: a second run runs nothing, and the file stays", async () => {
		const before = fileText();
		const outcome = await schemaApply(options());
		expect(outcome.ok).toBe(true);
		expect(outcome.text).toContain("No transform to run. Recorded the schema at version 2.");
		expect(outcome.text).toContain("No change to collections, fields, options, locales or allowed blocks.");
		expect(fileText()).toBe(before);
		expect((await schemaDiff({ ...options(), check: true })).exitCode).toBe(0);
	});

	it("refuses a transform that does not fit the schema, and applies nothing", async () => {
		writeFileSync(
			file,
			schema(
				{ excerpt: { kind: "text", label: "Excerpt" } },
				{
					schemaVersion: 2,
					migrations: [
						{ id: "rename-summary", op: "renameField", collection: "post", from: "summary", to: "excerpt" },
						{ id: "drop-excerpt", op: "dropField", collection: "post", field: "excerpt" },
					],
				},
			),
		);
		const before = fileText();
		const outcome = await schemaApply(options());
		expect(outcome.ok).toBe(false);
		expect(outcome.text).toContain("PROBLEM drop-excerpt: post.excerpt is still a field of the schema");
		expect(outcome.text).toContain("Nothing was applied.");
		expect(fileText()).toBe(before);
		expect((await metadataOf("one"))?.metadata).toEqual({ title: "one", excerpt: "First" });
	});

	it("runs through the monti command line", async () => {
		const lines: string[] = [];
		// Without a server file the command reports it, like any command that needs the app.
		const code = await runCli(["schema:diff", "--schema", "monti.schema.ts", "--no-env-file"], {
			cwd: dir,
			log: (message) => lines.push(message),
			error: (message) => lines.push(message),
		});
		expect(code).toBe(1);
		expect(lines.join("\n")).toMatch(/Cannot find monti\.config\.ts.*monti init/s);
	});
});
