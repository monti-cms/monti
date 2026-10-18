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
import { schemaApply, schemaDiff } from "../schema-apply";

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
		const res = await pool.query<{ metadata: Record<string, unknown> }>(
			`SELECT b.metadata FROM "${schemaName}".entry_bodies b JOIN "${schemaName}".entries e ON e.id = b.entry_id
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
		expect(outcome.text).toContain("No transform to run. Recorded the schema.");
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
		expect(diff.text).not.toMatch(/version/i);
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

	it("applies the transforms and rewrites the transformed entries, leaving the file as it is", async () => {
		const before = fileText();
		const outcome = await schemaApply(options());
		expect(outcome.ok).toBe(true);
		expect(outcome.text).toContain("Ran rename-summary: 2 entries");
		expect(outcome.text).toContain("Recorded the schema (2 entries rewritten).");
		expect(fileText()).toBe(before);
		const one = await metadataOf("one");
		expect(one?.metadata).toEqual({ title: "one", excerpt: "First" });
	});

	it("is idempotent: a second run runs nothing, and the file stays", async () => {
		const before = fileText();
		const outcome = await schemaApply(options());
		expect(outcome.ok).toBe(true);
		expect(outcome.text).toContain("No transform to run. Recorded the schema.");
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
