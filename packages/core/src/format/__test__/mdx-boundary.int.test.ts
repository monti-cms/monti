import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MDX is an optional format package (`@monti-cms/mdx`), not a part of core: a text format is a plugin behind the `format` option. Biome keeps the core's
 * files from importing the MDX package and its ecosystem (`noRestrictedImports` in `biome.json`); this checks what lint cannot see, the published manifest.
 */
const CORE_ROOT = path.resolve(__dirname, "../../..");

const MDX_PACKAGE = /^@monti-cms\/mdx(\/|$)/;
const MDX_ECOSYSTEM =
	/^(unified|vfile|next-mdx-remote|@mdx-js\/[^/]+|@types\/mdast|mdast(-[^/]+)?|micromark(-[^/]+)?|remark(-[^/]+)?|rehype(-[^/]+)?)(\/.*)?$/;
const isForbidden = (specifier: string) => MDX_PACKAGE.test(specifier) || MDX_ECOSYSTEM.test(specifier);

describe("the core package manifest has no MDX in it", () => {
	it("FMT-P1 depends on no MDX package, in any dependency field", () => {
		const manifest = JSON.parse(readFileSync(path.join(CORE_ROOT, "package.json"), "utf8")) as Record<string, unknown>;
		const names = ["dependencies", "peerDependencies", "devDependencies", "optionalDependencies"].flatMap((field) =>
			Object.keys((manifest[field] as Record<string, string> | undefined) ?? {}),
		);
		expect(names.filter(isForbidden)).toEqual([]);
	});

	it("FMT-P1 does not export the entry points that held MDX", () => {
		const manifest = JSON.parse(readFileSync(path.join(CORE_ROOT, "package.json"), "utf8")) as {
			exports: Record<string, unknown>;
		};
		for (const key of ["./mdx", "./syntax", "./format/mdx"]) expect(manifest.exports).not.toHaveProperty(key);
	});
});
