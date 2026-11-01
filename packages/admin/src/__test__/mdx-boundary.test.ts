import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The admin knows no text notation. The MDX source panel and the `mdx` format come from `@monti-cms/mdx`, which registers them through the plugin slots
 * (`sourcePanels`, `formats`), and the MDX package depends on the admin, so the other way round would be a cycle. Biome keeps the admin's code from
 * importing it (`noRestrictedImports` in `biome.json`); this checks what lint cannot see, the published manifest.
 */
const ADMIN_ROOT = path.resolve(__dirname, "../..");

const MDX_PACKAGE = /^@monti-cms\/mdx(\/|$)/;

describe("the admin package manifest has no MDX in it", () => {
	it("FMT-P1 the manifest does not list it in any dependency field", () => {
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
