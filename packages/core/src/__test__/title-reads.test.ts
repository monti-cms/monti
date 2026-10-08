import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The title field is named by its role (`role: "title"`), so no code may read it by the key `title`. A query builds the SQL with `titleExpr`, and JS code
 * reads it with `titleFieldOf`, `titleValue` or `site.titleField` / `site.titleOfValues`. This scans the packages' sources for the ways a hard-coded key shows up:
 * `metadata->>'title'`, `metadata.title`, `metadata["title"]`, `storedField(collection, "title")`, `stored.name === "title"` and `form.title`.
 * (A text that is only called "title", such as a link title or a block attribute, does not match these shapes.)
 */

const PACKAGES = path.resolve(import.meta.dirname, "../../..");

const HARD_CODED_TITLE = [
	/->>\s*'title'/,
	/\bmetadata\??\.title\b/,
	/\bmetadata\??\.?\[\s*["']title["']\s*\]/,
	/\bstoredField\([^)]*,\s*["']title["']\s*\)/,
	/\.name\s*[!=]==?\s*["']title["']/,
	/\bform\??\.title\b/,
	/\bform\??\.?\[\s*["']title["']\s*\]/,
];

const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** The source files (tests and test fixtures left out) of every package. */
function sourcesUnder(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			return ["__test__", "node_modules", "dist", "test", ".next"].includes(entry.name) ? [] : sourcesUnder(full);
		}
		return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
	});
}

const hardCodedIn = (files: string[], root: string) =>
	files.flatMap((file) =>
		code(readFileSync(file, "utf8"))
			.split("\n")
			.flatMap((line, index) =>
				HARD_CODED_TITLE.some((pattern) => pattern.test(line))
					? [`${path.relative(root, file)}:${index + 1}: ${line.trim()}`]
					: [],
			),
	);

describe("the title key", () => {
	it("is not hard-coded in a package's sources", () => {
		const files = readdirSync(PACKAGES, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.flatMap((entry) => sourcesUnder(path.join(PACKAGES, entry.name, "src")));
		const names = files.map((file) => path.relative(PACKAGES, file));
		// The scan reaches the SQL, the admin, the plugins that read the title and the file that knows the default name.
		expect(names).toContain("core/src/adapters/postgres/store/list.ts");
		expect(names).toContain("admin/src/screens/entries/entry-form.ts");
		expect(names).toContain("seo/src/read.ts");
		expect(hardCodedIn(files, PACKAGES)).toEqual([]);
	});

	it("the scan catches each shape of a hard-coded title", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "title-reads-"));
		const cases = [
			"SELECT b.metadata->>'title' AS title FROM entry_bodies b",
			"const title = entry.working.metadata.title;",
			'const title = metadata["title"];',
			'const field = site.storedField(collection, "title");',
			'if (stored.name === "title") continue;',
			"const heading = form.title.trim();",
		];
		const files = cases.map((line, index) => {
			const file = path.join(dir, `case-${index}.ts`);
			writeFileSync(file, `${line}\n`);
			return file;
		});
		const clean = path.join(dir, "clean.ts");
		writeFileSync(
			clean,
			'// metadata.title, form.title\nexport const link = { title: "x" };\nconst name = item.title;\nconst name2 = site.titleOfValues(collection, metadata);\n',
		);
		expect(hardCodedIn([...files, clean], dir)).toHaveLength(cases.length);
	});
});
