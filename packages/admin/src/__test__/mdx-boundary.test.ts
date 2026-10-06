import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The admin knows no text notation. The MDX source panel and the `mdx` format come from `@monti-cms/mdx`, which registers them through the plugin slots
 * (`sourcePanels`, `formats`). So the admin's own code may not import the MDX package, and its manifest may not depend on or peer on it (the MDX package depends on
 * the admin, so the other way round would be a cycle). Tests are different: they describe bodies as MDX text, and read the package source through the one helper
 * `src/test/mdx.ts`, so only the production source is checked.
 */
const ADMIN_ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(ADMIN_ROOT, "src");

const MDX_PACKAGE = /^@monti-cms\/mdx(\/|$)/;
const SPECIFIER = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

const isTestFile = (file: string) => /(__test__|\.test\.|[\\/]src[\\/]test[\\/])/.test(file);

const sourceFiles = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(full);
		return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
	});

const mdxImports = (source: string): string[] =>
	[...source.matchAll(SPECIFIER)].map((match) => match[1] as string).filter((specifier) => MDX_PACKAGE.test(specifier));

describe("the admin does not import the MDX package", () => {
	it("recognizes static, type-only, re-export and dynamic imports, and ignores the rest", () => {
		const source = [
			'import { mdxBrowserFormat } from "@monti-cms/mdx/admin";',
			'import type { Body } from "@monti-cms/mdx/format";',
			'export * from "@monti-cms/mdx";',
			'const lazy = await import("@monti-cms/mdx/server");',
			'import { x } from "@monti-cms/core/document";',
			'import { y } from "../mdx-source";',
		].join("\n");
		expect(mdxImports(source)).toEqual([
			"@monti-cms/mdx/admin",
			"@monti-cms/mdx/format",
			"@monti-cms/mdx",
			"@monti-cms/mdx/server",
		]);
	});

	it("no production source file of the admin imports it", () => {
		const found = sourceFiles(SRC)
			.filter((file) => !isTestFile(file))
			.flatMap((file) =>
				mdxImports(readFileSync(file, "utf8")).map((specifier) => `${path.relative(ADMIN_ROOT, file)}: ${specifier}`),
			);
		expect(found).toEqual([]);
	});

	it("the manifest does not list it in any dependency field", () => {
		const manifest = JSON.parse(readFileSync(path.join(ADMIN_ROOT, "package.json"), "utf8")) as Record<string, unknown>;
		for (const field of ["dependencies", "peerDependencies", "devDependencies", "optionalDependencies"]) {
			expect(
				Object.keys((manifest[field] as Record<string, string> | undefined) ?? {}).filter((name) =>
					MDX_PACKAGE.test(name),
				),
			).toEqual([]);
		}
	});
});
