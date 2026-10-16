import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../core/test/site";
import "../format";
import { checkMdxOptions, MDX_PLUGIN_NAME, mdx } from "../plugin";
import type { SyntaxExtension } from "../syntax";
import { docOfMdx } from "../testing";

/** A made-up extension: marks of the type `underline` are written as `{u text}`. */
const braces: SyntaxExtension = {
	name: "braces",
	fromMark: { underline: (_mark, inner) => `{u ${inner}}` },
};
const other: SyntaxExtension = { name: "other" };

describe("mdx()", () => {
	it("is a plugin named mdx whose options are the ones it was given", () => {
		const plugin = mdx({ syntax: [braces] });
		expect(plugin.name).toBe(MDX_PLUGIN_NAME);
		expect(plugin.name).toBe("mdx");
		expect(plugin.options).toEqual({ syntax: [braces] });
		expect(plugin.options.syntax?.[0]).toBe(braces);
	});

	it("works without options", () => {
		const plugin = mdx();
		expect(plugin.name).toBe("mdx");
		expect(plugin.options).toEqual({});
	});

	it("provides its admin side and its formats lazily", () => {
		const plugin = mdx();
		expect(typeof plugin.admin).toBe("function");
		expect(typeof (plugin.server as { formats?: unknown }).formats).toBe("function");
	});

	describe("validation", () => {
		it("accepts distinct named extensions, and no extension at all", () => {
			expect(checkMdxOptions({ syntax: [braces, other] })).toEqual([]);
			expect(checkMdxOptions({})).toEqual([]);
			expect(checkMdxOptions(undefined)).toEqual([]);
		});

		it("rejects an extension without a name", () => {
			const nameless = { ...braces, name: "" };
			expect(checkMdxOptions({ syntax: [nameless] })).toEqual([expect.objectContaining({ code: "name" })]);
		});

		it("rejects the same name listed twice", () => {
			expect(checkMdxOptions({ syntax: [braces, { ...other, name: braces.name }] })).toEqual([
				expect.objectContaining({ code: "duplicate" }),
			]);
			expect(mdx({ syntax: [braces, braces] }).checkConfig?.({} as never)).toEqual([
				expect.objectContaining({ code: "duplicate" }),
			]);
		});

		it("is run again by the validate hook of the plugin", () => {
			const plugin = mdx({ syntax: [braces] });
			expect(() => plugin.checkConfig?.({} as never)).not.toThrow();
		});
	});

	describe("formats", () => {
		const formatOf = async (options?: Parameters<typeof mdx>[0]) => {
			const provided = await (mdx(options).server as { formats(): Promise<unknown> }).formats();
			if (!provided || Array.isArray(provided)) throw new Error("expected one format");
			return provided as import("@monti-cms/core/format").CmsFormat;
		};

		it("resolves to a format named mdx", async () => {
			const format = await formatOf();
			expect(format.name).toBe("mdx");
			expect(format.extension).toBe("mdx");
			expect(typeof format.import).toBe("function");
		});

		it("writes and reads with the syntax it was given", async () => {
			const doc = {
				...docOfMdx(testSite, "x"),
				content: [{ type: "paragraph", content: [{ type: "text", text: "word", marks: [{ type: "underline" }] }] }],
			};
			const { siteSyntaxBlocks, siteCodeLineEffects } = await import("../syntax-config");
			const exportContext = {
				locale: "ko",
				blocks: siteSyntaxBlocks(testSite),
				site: testSite,
				codeLineEffects: siteCodeLineEffects(testSite),
				purpose: "read" as const,
				link: () => null,
				media: () => null,
				report: () => {},
			};
			const plain = await formatOf();
			const extended = await formatOf({ syntax: [braces] });
			expect(await extended.export(doc, exportContext)).toContain("{u word}");
			expect(await plain.export(doc, exportContext)).not.toContain("{u word}");
		});
	});
});

describe("the root entry", () => {
	const SRC = path.resolve(__dirname, "..");
	const filesUnder = (dir: string): string[] =>
		readdirSync(dir).flatMap((name) => {
			const full = path.join(dir, name);
			return statSync(full).isDirectory() ? filesUnder(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
		});
	/** The packages a file imports at run time (`from "x"`, `import "x"`, `import("x")`); a type-only import leaves nothing in the built file. */
	const importsOf = (file: string): string[] => {
		const text = readFileSync(file, "utf8").replace(/^(?:import|export)\s+type\s[^;]*;/gm, "");
		return [...text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((match) => match[1] as string);
	};
	const PARSER_PACKAGES = /^(unified|remark|rehype|mdast|micromark|unist)/;

	it("imports no remark package at run time: it is read by the site config in the browser as well", () => {
		const files = [path.join(SRC, "index.ts"), path.join(SRC, "plugin.ts"), ...filesUnder(path.join(SRC, "syntax"))];
		expect(files.length).toBeGreaterThan(2);
		for (const file of files) {
			const parser = importsOf(file).filter((name) => PARSER_PACKAGES.test(name));
			expect(parser, path.relative(SRC, file)).toEqual([]);
		}
	});

	it("does not import the parts that parse MDX at load time", () => {
		const heavy = new Set(["./format", "./body", "./analyze", "./serialize", "./parse", "./render", "./server"]);
		for (const file of [path.join(SRC, "index.ts"), path.join(SRC, "plugin.ts")]) {
			const text = readFileSync(file, "utf8");
			const staticImports = [...text.matchAll(/^(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/gm)].map(
				(match) => match[1] as string,
			);
			expect(
				staticImports.filter((name) => heavy.has(name)),
				path.relative(SRC, file),
			).toEqual([]);
		}
	});
});
