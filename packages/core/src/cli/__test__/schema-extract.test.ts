import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import blog from "../../../test/cms.config";
import otherSite from "../../../test/other-site.config";
import { defineCollection, defineConfig, definePlugin, fields } from "../..";
import type { CmsConfig } from "../../config/define";
import { createSite } from "../../site";
import { runCli } from "..";
import { extractSchema, extractSchemaData, formatExtractReport, schemaFileText } from "../schema-extract";
import { generateSchemaTypes } from "../schema-types";

let dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
});
const tempDir = () => {
	const dir = mkdtempSync(path.join(tmpdir(), "monti-extract-"));
	dirs.push(dir);
	return dir;
};

/** What `createSite` resolves the collections to: labels as the admin shows them, functions dropped. The thing that must survive the round trip. */
const collectionsOf = (config: CmsConfig) => createSite(config).snapshot().collections;

/** The code part a site keeps after extraction: everything the schema file does not hold. */
const codePart = (config: CmsConfig) => ({
	plugins: config.plugins,
	blocks: config.blocks,
	media: config.media,
	codeBlock: config.codeBlock,
	site: config.site?.url ? { url: config.site.url } : undefined,
});

describe("extract -> load round trip", () => {
	for (const [name, config] of [
		["the reference blog", blog],
		["the other site (different fields, tabs and list columns)", otherSite],
	] as const) {
		it(`loads ${name} back to the same site`, () => {
			const { schema } = extractSchemaData(config as CmsConfig);
			// Through text, the way the file is written and read.
			const file = JSON.parse(schemaFileText(schema));
			const loaded = defineConfig({ schema: file, ...codePart(config as CmsConfig) });
			const original = config as CmsConfig;

			expect(collectionsOf(loaded)).toEqual(collectionsOf(original));
			expect(loaded.locales).toEqual(original.locales);
			expect(loaded.defaultLocale).toBe(original.defaultLocale);
			expect(loaded.timeZone).toBe(original.timeZone);
			expect(loaded.site).toEqual(original.site);
			expect(loaded.admin).toEqual(original.admin);
			expect(loaded.seed).toEqual(original.seed);
			// And the site the instance builds from it answers the same.
			const a = createSite(original);
			const b = createSite(loaded);
			expect(b.COLLECTIONS).toEqual(a.COLLECTIONS);
			expect(b.LOCALES).toEqual(a.LOCALES);
			expect(b.ADMIN_PATH).toBe(a.ADMIN_PATH);
			for (const collection of a.COLLECTIONS) {
				expect(b.storedFields(collection)).toEqual(a.storedFields(collection));
				expect(b.contentPath(collection, "x")).toBe(a.contentPath(collection, "x"));
			}
		});
	}

	it("writes the link to the JSON Schema first, and omits a body flag that is the default", () => {
		const { schema } = extractSchemaData(blog as CmsConfig);
		const text = schemaFileText(schema);
		expect(text.startsWith('{\n\t"$schema": "./node_modules/@monti-cms/core/schema.json",')).toBe(true);
		const file = JSON.parse(text);
		expect(file.collections.post).not.toHaveProperty("body");
		expect(file.collections.category).not.toHaveProperty("body");
		const withBody = defineConfig({
			collections: {
				note: defineCollection({
					label: "Note",
					kind: "item",
					body: true,
					fields: { title: fields.text({ label: "T" }), slug: fields.slug({ label: "S" }) },
				}),
			},
			locales: [{ code: "en", name: "English" }],
			defaultLocale: "en",
		});
		expect(extractSchemaData(withBody).schema.collections.note?.body).toBe(true);
	});

	it("writes the labels plugins provide in the language asked for, else in the admin language of the site", () => {
		const labelOf = (locale?: string) =>
			extractSchemaData(blog as CmsConfig, { locale }).schema.collections.post?.fields.seoTitle?.label;
		expect(labelOf()).toBe("검색 제목"); // cms-allow-korean: the reference blog's admin language is Korean
		expect(labelOf("en")).toBe("Search title");
	});

	it("keeps the plugin-provided fields (seoFields) as plain fields of the collection", () => {
		const { schema } = extractSchemaData(blog as CmsConfig);
		const post = schema.collections.post;
		expect(post?.fields.searchPreview).toMatchObject({ kind: "view", view: "search" });
		expect(post?.fields.seoTitle).toMatchObject({ kind: "text", role: "seoTitle", tab: "SEO" });
	});
});

describe("what stays in code", () => {
	it("lists blocks, site.url and what else needs code, and nothing about data", () => {
		const { stays } = extractSchemaData(blog as CmsConfig);
		expect(stays.map((item) => item.what)).toEqual(["site.url", "blocks"]);
		expect(stays[1]?.detail).toContain("callout");
		expect(stays[1]?.detail).toContain("notice");
	});

	it("lists plugins by name, codeBlock and media, and options that cannot be written as JSON", () => {
		const plugin = definePlugin({ name: "my-plugin", options: {} });
		const config = defineConfig({
			collections: {
				note: defineCollection({
					label: "Note",
					kind: "item",
					fields: {
						title: fields.text({ label: "T", inputOptions: { size: (() => 1) as never } }),
						slug: fields.slug({ label: "S" }),
					},
				}),
			},
			locales: [{ code: "en", name: "English" }],
			defaultLocale: "en",
			plugins: [plugin],
			media: { maxImageBytes: 1000 },
			codeBlock: { themes: { light: "github-light", dark: "github-dark" } },
			admin: { messages: { "cms-admin.entries": { publish: "Ship it", unpublish: () => "Pull it" } } },
		});
		const { schema, stays } = extractSchemaData(config);
		expect(stays.map((item) => item.what)).toEqual([
			"collection options that are functions",
			"admin.messages",
			"plugins",
			"codeBlock",
			"media",
		]);
		expect(stays[0]?.detail).toContain("collections.note.fields.title.inputOptions.size");
		expect(stays[1]?.detail).toContain("cms-admin.entries.unpublish");
		expect(stays[2]?.detail).toContain("my-plugin");
		// The text overrides that are strings stay in the schema.
		expect(schema.admin?.messages).toEqual({ "cms-admin.entries": { publish: "Ship it" } });
	});

	it("says nothing needs to stay in code for a config that is all data", () => {
		const config = defineConfig({
			collections: {
				note: defineCollection({
					label: "Note",
					kind: "item",
					fields: { title: fields.text({ label: "T" }), slug: fields.slug({ label: "S" }) },
				}),
			},
			locales: [{ code: "en", name: "English" }],
			defaultLocale: "en",
		});
		const { stays } = extractSchemaData(config);
		expect(stays).toEqual([]);
		const text = formatExtractReport({
			config: "cms.config.ts",
			schema: "monti.schema.json",
			collections: 1,
			locales: 1,
			templates: 0,
			stays,
		});
		expect(text).toContain("Nothing needs to stay in code");
		// The import line is relative to the config file, whichever side the schema file is on.
		const importOf = (config: string, schema: string) =>
			formatExtractReport({ config, schema, collections: 1, locales: 1, templates: 0, stays }).match(
				/import schema from "(.*)";/,
			)?.[1];
		expect(importOf("cms.config.ts", "monti.schema.json")).toBe("./monti.schema.json");
		expect(importOf("src/cms.config.ts", "src/monti.schema.json")).toBe("./monti.schema.json");
		expect(importOf("src/cms.config.ts", "monti.schema.json")).toBe("../monti.schema.json");
	});
});

describe("monti schema:extract", () => {
	const plugin = definePlugin({ name: "my-plugin", options: {} });
	const config = defineConfig({
		collections: {
			note: defineCollection({
				label: "Note",
				kind: "document",
				fields: {
					title: fields.text({ label: "T", required: true }),
					slug: fields.slug({ label: "S", from: "title" }),
				},
			}),
		},
		locales: [{ code: "en", name: "English" }],
		defaultLocale: "en",
		site: { url: "https://example.com", name: "Notes" },
		plugins: [plugin],
	});
	const load = async () => ({ default: config });

	function site(): { dir: string; run: (...args: string[]) => Promise<{ code: number; out: string; err: string }> } {
		const dir = tempDir();
		writeFileSync(path.join(dir, "cms.config.ts"), "export default {};\n");
		return {
			dir,
			run: async (...args) => {
				const out: string[] = [];
				const err: string[] = [];
				const code = await runCli(args, { cwd: dir, log: (line) => out.push(line), error: (line) => err.push(line) });
				return { code, out: out.join("\n"), err: err.join("\n") };
			},
		};
	}

	it("writes the schema file and its types, and reports what stays in code and how to load the schema", async () => {
		const { dir } = site();
		const report = await extractSchema({ cwd: dir, load });
		expect(report).toMatchObject({ schema: "monti.schema.json", types: "monti-env.d.ts", collections: 1, locales: 1 });
		const file = JSON.parse(readFileSync(path.join(dir, "monti.schema.json"), "utf8"));
		expect(file.$schema).toBe("./node_modules/@monti-cms/core/schema.json");
		expect(file.site).toEqual({ name: "Notes" });
		expect(readFileSync(path.join(dir, "monti-env.d.ts"), "utf8")).toContain("interface MontiRegister");
		const text = formatExtractReport(report);
		expect(text).toContain("Stays in code (cms.config.ts):");
		expect(text).toContain("site.url");
		expect(text).toContain("plugins: my-plugin");
		expect(text).toContain('import schema from "./monti.schema.json";');
		// The types are in step with the schema it wrote.
		expect(generateSchemaTypes({ cwd: dir, check: true }).changed).toBe(false);
	});

	it("does not replace an existing schema file unless asked, and writes next to a config in src/", async () => {
		const { dir } = site();
		await extractSchema({ cwd: dir, load });
		await expect(extractSchema({ cwd: dir, load })).rejects.toThrow(
			/monti\.schema\.json already exists; pass --overwrite/,
		);
		await expect(extractSchema({ cwd: dir, load, overwrite: true })).resolves.toMatchObject({
			schema: "monti.schema.json",
		});
		mkdirSync(path.join(dir, "src"));
		writeFileSync(path.join(dir, "src/cms.config.ts"), "export default {};\n");
		const report = await extractSchema({ cwd: dir, load, config: "src/cms.config.ts" });
		expect(report.schema).toBe("src/monti.schema.json");
		expect(report.types).toBe("src/monti-env.d.ts");
		expect(JSON.parse(readFileSync(path.join(dir, "src/monti.schema.json"), "utf8")).$schema).toBe(
			"../node_modules/@monti-cms/core/schema.json",
		);
	});

	it("can skip the types, and says what is wrong with a missing or wrong config file", async () => {
		const { dir } = site();
		const report = await extractSchema({ cwd: dir, load, types: false });
		expect(report.types).toBeUndefined();
		const empty = tempDir();
		await expect(extractSchema({ cwd: empty, load })).rejects.toThrow(/cannot find cms\.config\.ts; pass --config/);
		await expect(extractSchema({ cwd: dir, load, config: "nope.ts", overwrite: true })).rejects.toThrow(
			/config file not found: nope\.ts/,
		);
		await expect(
			extractSchema({ cwd: dir, load: async () => ({ default: { not: "a config" } }), overwrite: true }),
		).rejects.toThrow(/must export the site config/);
	});

	it("is a command: schema:extract through the command line reports failures with exit code 1", async () => {
		const { run } = site();
		const missing = await run("schema:extract", "--config", "missing.config.ts");
		expect(missing.code).toBe(1);
		expect(missing.err).toContain("config file not found: missing.config.ts");
	});
});
