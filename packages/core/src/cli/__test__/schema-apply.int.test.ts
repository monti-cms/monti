import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
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

	// Each test gets its own folder and database schema, so none starts from what another test applied.
	beforeEach(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		dir = mkdtempSync(path.join(tmpdir(), "monti-schema-"));
		file = path.join(dir, "monti.schema.ts");
	});

	afterEach(async () => {
		rmSync(dir, { recursive: true, force: true });
		await dropIsolatedTestPool(pool, schemaName);
	});

	afterAll(async () => {
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

	it("SCHEMA-C1 applies a schema change in steps: baseline, diff, dry run, apply, apply again, then refuses a transform that does not fit", async () => {
		// Baseline: it changes nothing, and writes nothing to the file.
		{
			writeFileSync(file, schema({ summary: { kind: "text", label: "Summary" } }));
			const before = fileText();
			const outcome = await schemaApply(options());
			expect(outcome.ok).toBe(true);
			expect(outcome.text).toContain("No schema has been applied to this store yet");
			expect(outcome.text).toContain("No transform to run. Recorded the schema.");
			expect(fileText()).toBe(before);
		}

		// Diff: it shows what a change touches before it is applied.
		{
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
						migrations: [
							{ id: "rename-summary", op: "renameField", collection: "post", from: "summary", to: "excerpt" },
						],
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
		}

		// Dry run: it reports and changes nothing, not even the file.
		{
			const before = fileText();
			const outcome = await schemaApply({ ...options(), dryRun: true });
			expect(outcome.ok).toBe(true);
			expect(outcome.text).toContain("Ran rename-summary: 2 entries");
			expect(outcome.text).toContain("Dry run: nothing was changed.");
			expect(fileText()).toBe(before);
			expect((await metadataOf("one"))?.metadata).toMatchObject({ summary: "First" });
		}

		// Apply: it runs the transforms and rewrites the transformed entries, leaving the file as it is.
		{
			const before = fileText();
			const outcome = await schemaApply(options());
			expect(outcome.ok).toBe(true);
			expect(outcome.text).toContain("Ran rename-summary: 2 entries");
			expect(outcome.text).toContain("Recorded the schema (2 entries rewritten).");
			expect(fileText()).toBe(before);
			const one = await metadataOf("one");
			expect(one?.metadata).toEqual({ title: "one", excerpt: "First" });
		}

		// Apply again: it is idempotent; a second run runs nothing, and the file stays.
		{
			const before = fileText();
			const outcome = await schemaApply(options());
			expect(outcome.ok).toBe(true);
			expect(outcome.text).toContain("No transform to run. Recorded the schema.");
			expect(outcome.text).toContain("No change to collections, fields, options, locales or allowed blocks.");
			expect(fileText()).toBe(before);
			expect((await schemaDiff({ ...options(), check: true })).exitCode).toBe(0);
		}

		// A transform that does not fit the schema is refused, and nothing is applied.
		{
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
		}
	});

	it("SCHEMA-C1 lists an added language as a change that touches no entry", async () => {
		writeFileSync(file, schema({}));
		expect((await schemaApply(options())).ok).toBe(true);
		const both = [
			{ code: "en", name: "English" },
			{ code: "ko", name: "Korean" },
		];
		writeFileSync(file, schema({}, { locales: both }));
		const diff = await schemaDiff(options());
		expect(diff.text.split("\n")).toContain('  - locale "ko" added');
	});

	it("SCHEMA-C2 moves the translations of a removed language to the trash when the file says so, and says so", async () => {
		const excerpt = { excerpt: { kind: "text", label: "Excerpt" } };
		const both = [
			{ code: "en", name: "English" },
			{ code: "ko", name: "Korean" },
		];
		writeFileSync(file, schema(excerpt, { locales: both }));
		expect((await schemaApply(options())).ok).toBe(true);
		const cms = await loadCms();
		const source = await cms.contentService().createDraft({
			collection: "post",
			slug: "one",
			metadata: { title: "one", excerpt: "First" },
			doc: docOfText("Body one"),
		} as never);
		const translation = (await cms.contentService().createTranslation({ sourceId: source.entry.id, locale: "ko" }))
			.entry;
		await cms.close();

		writeFileSync(file, schema(excerpt, { migrations: [{ id: "trash-ko", op: "trashLocale", locale: "ko" }] }));
		const diff = await schemaDiff(options());
		expect(diff.text).toContain('locale "ko" removed [transform trash-ko]: 1 entry');
		expect(diff.text).toContain("translations MOVED TO THE TRASH by its trash transform");
		const statusOf = async () =>
			(
				await pool.query<{ status: string }>(`SELECT status FROM "${schemaName}".entries WHERE id = $1`, [
					translation.id,
				])
			).rows[0]?.status;
		expect(await statusOf()).toBe("draft");

		const outcome = await schemaApply(options());
		expect(outcome.ok).toBe(true);
		expect(outcome.text).toContain("Moved 1 ko translations to the trash.");
		expect(await statusOf()).toBe("trashed");
	});

	it("SCHEMA-C1 runs through the monti command line", async () => {
		writeFileSync(file, schema({}));
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
