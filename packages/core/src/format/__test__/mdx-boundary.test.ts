import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MDX is an optional format package (`@monti-cms/mdx`), not a part of core. Core renders and stores documents; a text format is a plugin behind the `format` option.
 * Nothing in the core package may import the MDX package or anything that exists for MDX (the remark and rehype family, `unified`, `vfile`, the mdast types,
 * micromark, `next-mdx-remote`), and its `package.json` may not depend on them. A new reach has to be a deliberate edit of this test.
 */
const CORE_ROOT = path.resolve(__dirname, "../../..");

const MDX_PACKAGE = /^@monti-cms\/mdx(\/|$)/;
const MDX_ECOSYSTEM =
	/^(unified|vfile|next-mdx-remote|@mdx-js\/[^/]+|@types\/mdast|mdast(-[^/]+)?|micromark(-[^/]+)?|remark(-[^/]+)?|rehype(-[^/]+)?)(\/.*)?$/;
const isForbidden = (specifier: string) => MDX_PACKAGE.test(specifier) || MDX_ECOSYSTEM.test(specifier);

const SPECIFIER = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

const sourceFiles = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return ["node_modules", "dist", "build"].includes(entry.name) ? [] : sourceFiles(full);
		return /\.(ts|tsx|mjs|cjs|js)$/.test(entry.name) ? [full] : [];
	});

/** The module specifiers `source` imports that point at the MDX package or its ecosystem (package names, not relative paths). */
const forbiddenImports = (source: string): string[] =>
	[...source.matchAll(SPECIFIER)].map((match) => match[1] as string).filter(isForbidden);

describe("core has no MDX in it", () => {
	it("recognizes imports of the MDX package and its ecosystem, and ignores the rest", () => {
		const source = [
			'import { mdx } from "@monti-cms/mdx";',
			'import { renderMdx } from "@monti-cms/mdx/render";',
			'import { unified } from "unified";',
			'import remarkGfm from "remark-gfm";',
			'import type { Root } from "mdast";',
			'const lazy = await import("next-mdx-remote/rsc");',
			'import { visit } from "unist-util-visit";',
			'import { toJsxRuntime } from "hast-util-to-jsx-runtime";',
			'import { x } from "../doc/block-ids";',
			'import { y } from "@monti-cms/core/document";',
		].join("\n");
		expect(forbiddenImports(source)).toEqual([
			"@monti-cms/mdx",
			"@monti-cms/mdx/render",
			"unified",
			"remark-gfm",
			"mdast",
			"next-mdx-remote/rsc",
		]);
	});

	it("no file of the core package imports the MDX package or anything remark", () => {
		const found = sourceFiles(CORE_ROOT)
			.map((file) => ({ file: path.relative(CORE_ROOT, file), imports: forbiddenImports(readFileSync(file, "utf8")) }))
			.filter(
				({ file, imports }) =>
					imports.length > 0 && file !== path.join("src", "format", "__test__", "mdx-boundary.test.ts"),
			)
			.map(({ file, imports }) => `${file}: ${imports.join(", ")}`);
		expect(found).toEqual([]);
	});

	it("the package manifest depends on none of them, in any dependency field", () => {
		const manifest = JSON.parse(readFileSync(path.join(CORE_ROOT, "package.json"), "utf8")) as Record<string, unknown>;
		const names = ["dependencies", "peerDependencies", "devDependencies", "optionalDependencies"].flatMap((field) =>
			Object.keys((manifest[field] as Record<string, string> | undefined) ?? {}),
		);
		expect(names.filter(isForbidden)).toEqual([]);
	});

	it("does not export the entry points that held MDX", () => {
		const manifest = JSON.parse(readFileSync(path.join(CORE_ROOT, "package.json"), "utf8")) as {
			exports: Record<string, unknown>;
		};
		for (const key of ["./mdx", "./syntax", "./format/mdx"]) expect(manifest.exports).not.toHaveProperty(key);
	});
});
