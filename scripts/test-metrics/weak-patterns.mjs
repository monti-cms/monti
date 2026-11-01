#!/usr/bin/env node
/**
 * Counts test code patterns that weaken a test or tie it to how the code is built, per package, so the suite can be measured before and after a
 * change. It only counts: nothing fails, and a count is not a verdict on any one line (a `querySelector` can be the right tool).
 *
 *   node scripts/test-metrics/weak-patterns.mjs              # table per pattern and package
 *   node scripts/test-metrics/weak-patterns.mjs --json       # the same as JSON, with the files that hold the most of each pattern
 *   node scripts/test-metrics/weak-patterns.mjs --check      # fails when a package whose tests were overhauled has more than its `CEILING` (CI)
 *
 * Test code is every `*.test.*` / `*.spec.*` file under `packages/*` and every file in a `__test__` folder (shared suites and fixtures), except the
 * Playwright visual tests (`packages/ui/visual`). Names of the reference blog's config written in a test are counted by `site-names.mjs`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const asJson = process.argv.includes("--json");
const asCheck = process.argv.includes("--check");

/**
 * The most uses a package whose tests were overhauled may have, all patterns together: the count it was left with. CI fails above it, so a new use
 * is either fixed or written into `EXEMPT` with its reason. Lower it when uses are fixed; a package joins once its tests are overhauled.
 */
const CEILING = {
	core: 0,
	admin: 169,
	auth: 0,
	mdx: 0,
	blocks: 35,
	ui: 1,
	seo: 1,
	nextjs: 0,
	"storage-s3": 0,
	"syntax-directive": 0,
	"syntax-shiki": 0,
};

/** What each pattern says about a test. `regex` is matched per line (global), so a line can count more than once. */
const PATTERNS = [
	{
		name: "bilingual-name",
		why: "a regex that accepts the Korean or the English text; a negative check with it passes whatever the language",
		regex:
			/\/[^/\n]*[가-힣][^/\n]*\|[^/\n]*[A-Za-z]{2,}[^/\n]*\/|\/[^/\n]*[A-Za-z]{2,}[^/\n]*\|[^/\n]*[가-힣][^/\n]*\//g, // cms-allow-korean: matches Hangul
	},
	{
		name: "to-be-defined",
		why: "passes for any value that is not undefined (an error of any kind)",
		regex: /\.toBeDefined\(\)/g,
	},
	{ name: "to-be-truthy", why: "passes for any truthy value", regex: /\.toBeTruthy\(\)/g },
	{
		name: "silent-skip",
		why: "returns early inside a test, which reports a pass instead of a skip",
		regex: /if\s*\([^)]*\bskip\b[^)]*\)\s*return\b/g,
	},
	{
		name: "fixed-sleep",
		why: "waits a fixed time instead of for a condition or a clock",
		regex: /setTimeout\(\s*\w+\s*,\s*\d+\s*\)/g,
	},
	{ name: "long-wait", why: "a wait of a second or more", regex: /\btimeout:\s*\d[\d_]{3,}/g },
	{
		name: "class-name",
		why: "checks CSS classes, which is how a part looks",
		regex: /\.className\b|\.classList\b|toHaveClass\(/g,
	},
	{
		name: "data-attribute",
		why: "selects or checks a data attribute, which is how a part is built",
		regex: /\[data-[\w-]+|getAttribute\(\s*["']data-|\.dataset\./g,
	},
	{ name: "query-selector", why: "finds by CSS selector instead of role and name", regex: /querySelector(?:All)?\(/g },
	{ name: "test-id", why: "finds by test id instead of role and name", regex: /ByTestId\(/g },
	{ name: "own-module-mock", why: "replaces a module of the package itself", regex: /vi\.mock\(\s*["']\.\.?\//g },
	{ name: "mock-call-args", why: "reads the arguments of a mock call by position", regex: /\.mock\.calls\[/g },
	{
		name: "fetch-stub",
		why: "replaces fetch by hand, so a response shaped unlike the real one still passes",
		regex:
			/\bglobal(?:This)?\.fetch\s*=|vi\.stubGlobal\(\s*["']fetch["']|spyOn\(\s*global(?:This)?\s*,\s*["']fetch["']/g,
	},
	{
		name: "korean-copy",
		why: "finds an element by Korean text written in the test instead of the message dictionary (Korean test data is not counted)",
		regex:
			/ByRole\(\s*["'][\w-]+["']\s*,\s*\{[^}]*?\bname:\s*["'][^"'\n]*[가-힣]|By(?:Text|Label|Title|PlaceholderText|DisplayValue|AltText)\(\s*["'][^"'\n]*[가-힣]/g, // cms-allow-korean: matches Hangul
	},
	{
		name: "source-read",
		why: "reads a file from disk (often source text checked with a regex)",
		regex: /readFileSync\(|readFile\(/g,
	},
];

/**
 * Uses of a pattern that are right where they are, with the reason. The same list is applied to every version measured, so a count before and
 * after a change compare alike. `prefix` covers a folder; `file` with `count` covers that many uses in one file, and a use beyond them is counted.
 * A package's entries are written when its tests are overhauled (docs/testing.md), after reading each use.
 */
const EXEMPT = [
	...["class-name", "data-attribute"].map((pattern) => ({
		pattern,
		prefix: "packages/core/src/render/",
		why: "the renderer's output: the classes and attributes a site config asks for and site styles read",
	})),
	...["data-attribute", "query-selector"].flatMap((pattern) =>
		["packages/blocks/src/code-ref/__test__/", "packages/blocks/src/code-explorer/__test__/render.client.test.tsx"].map(
			(prefix) => ({
				pattern,
				prefix,
				why: "the site's rendered blocks and the script that runs on them: the attributes and classes are what the render, the script and the site styles share",
			}),
		),
	),
	{
		pattern: "long-wait",
		file: "packages/blocks/src/__test__/blocks.test.tsx",
		count: 2,
		why: "mermaid and chart load their heavy code on demand; the import alone can take seconds in a full parallel run",
	},
	...[
		["packages/blocks/src/__test__/component-showcase.test.tsx", 1],
		["packages/blocks/src/__test__/document-parity.test.tsx", 1],
	].map(([file, count]) => ({
		pattern: "source-read",
		file,
		count,
		why: "reads the showcase MDX the tests take as input: a fixture, not source",
	})),
	{
		pattern: "source-read",
		file: "packages/blocks/src/__test__/light-barrel.test.ts",
		count: 2,
		why: "checks what the light entry loads and the published exports: a lint rule cannot tell type-only and dynamic imports from the ones that load",
	},
	{
		pattern: "source-read",
		file: "packages/ui/src/__test__/cn.test.ts",
		count: 1,
		why: "reads the names the generated theme defines, as the cases to merge: a list of data, not source text checked for a rule",
	},
	{
		pattern: "korean-copy",
		prefix: "packages/ui/src/",
		why: "the parts have no dictionaries: every label is a prop, so the Korean names in their tests are the test's own data",
	},
	...[
		["packages/core/src/cli/__test__/write-regular-file.int.test.ts", 4],
		["packages/core/src/cli/__test__/schema-apply.int.test.ts", 1],
		["packages/core/src/cli/__test__/schema-extract.int.test.ts", 1],
		["packages/core/src/cli/__test__/init-helpers.ts", 1],
		["packages/core/src/schema-edit/__test__/schema-edit.int.test.ts", 1],
		["packages/core/src/schema-edit/__test__/title-rename.int.test.ts", 1],
	].map(([file, count]) => ({ pattern: "source-read", file, count, why: "reads the file the code under test wrote" })),
	...[
		["packages/core/src/cli/__test__/init-specs.int.test.ts", 1],
		["packages/core/src/format/__test__/mdx-boundary.int.test.ts", 2],
	].map(([file, count]) => ({
		pattern: "source-read",
		file,
		count,
		why: "reads a published package.json (peers, exports)",
	})),
	{
		pattern: "source-read",
		file: "packages/core/src/adapters/postgres/__test__/database-types.int.test.ts",
		count: 1,
		why: "compares the hand-written `db/database.ts` with a freshly migrated database, which neither tsc nor lint can see",
	},
	{
		pattern: "source-read",
		file: "packages/core/src/adapters/postgres/__test__/store-contract-files.int.test.ts",
		count: 1,
		why: "checks that every store contract suite has the test file that runs it: the test files are what it checks",
	},
	{
		pattern: "fetch-stub",
		file: "packages/admin/src/test/fake-api.ts",
		count: 1,
		why: "the one fake of the admin API: it answers in the shapes `src/api` declares, so screen tests never stub fetch themselves",
	},
	{
		pattern: "source-read",
		file: "packages/mdx/src/__test__/fixtures/samples.ts",
		count: 1,
		why: "reads the sample posts the tests take as input: fixtures, not source",
	},
	{
		pattern: "source-read",
		file: "packages/mdx/src/__test__/server-browser.test.ts",
		count: 1,
		why: "reads the published package.json: its browser condition is the product",
	},
	{
		pattern: "source-read",
		file: "packages/mdx/src/__test__/plugin.test.ts",
		count: 2,
		why: "checks what the browser bundle loads (no parser at run time): a lint rule cannot tell type-only and dynamic imports from the ones that load",
	},
	{
		pattern: "fetch-stub",
		file: "packages/auth/src/__test__/harness.ts",
		count: 1,
		why: "stands in for GitHub's OAuth endpoints: fetch is the network edge the login talks to",
	},
	{
		pattern: "fetch-stub",
		file: "packages/core/src/text-check/__test__/remote.test.ts",
		count: 3,
		why: "a client of a remote checking service: fetch is the network edge it talks to, the one place a stub belongs",
	},
	{
		pattern: "own-module-mock",
		file: "packages/core/src/adapters/postgres/__test__/lazy-adapter.test.ts",
		count: 1,
		why: "the mock is how the test sees that the module was loaded, which is the behavior under test",
	},
	{
		pattern: "long-wait",
		file: "packages/core/src/adapters/postgres/__test__/folders.int.test.ts",
		count: 1,
		why: "the upper bound of an `expect.poll`, which returns as soon as the condition holds",
	},
];

/** How many uses of `pattern` in `rel` the exemptions cover. */
const exempted = (pattern, rel, found) =>
	Math.min(
		found,
		EXEMPT.filter(
			(entry) => entry.pattern === pattern && (entry.prefix ? rel.startsWith(entry.prefix) : entry.file === rel),
		).reduce((sum, entry) => sum + (entry.prefix ? found : entry.count), 0),
	);

const isTestFile = (file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) || file.split(path.sep).includes("__test__");

const files = [];
const walk = (dir) => {
	for (const name of readdirSync(dir)) {
		// `.stryker-tmp` holds a copy of the sources while a mutation run is going.
		if (name === "node_modules" || name === "dist" || name === "storybook-static" || name === ".stryker-tmp") continue;
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) walk(full);
		else if (/\.[cm]?[jt]sx?$/.test(name) && isTestFile(full)) files.push(full);
	}
};
for (const name of readdirSync(path.join(root, "packages"))) {
	const dir = path.join(root, "packages", name);
	if (statSync(dir).isDirectory()) walk(dir);
}
const visual = path.join(root, "packages/ui/visual") + path.sep;
const testFiles = files.filter((file) => !file.startsWith(visual)).sort();

const packageOf = (file) => path.relative(path.join(root, "packages"), file).split(path.sep)[0];
const counts = Object.fromEntries(
	PATTERNS.map((pattern) => [pattern.name, { total: 0, exempt: 0, byPackage: {}, byFile: {} }]),
);
const filesPerPackage = {};
const linesPerPackage = {};

for (const file of testFiles) {
	const pkg = packageOf(file);
	const rel = path.relative(root, file);
	const text = readFileSync(file, "utf8");
	filesPerPackage[pkg] = (filesPerPackage[pkg] ?? 0) + 1;
	linesPerPackage[pkg] = (linesPerPackage[pkg] ?? 0) + text.split("\n").length;
	for (const pattern of PATTERNS) {
		const matched = text.match(pattern.regex)?.length ?? 0;
		const skipped = exempted(pattern.name, rel, matched);
		const found = matched - skipped;
		counts[pattern.name].exempt += skipped;
		if (!found) continue;
		const count = counts[pattern.name];
		count.total += found;
		count.byPackage[pkg] = (count.byPackage[pkg] ?? 0) + found;
		count.byFile[rel] = found;
	}
}

const packages = Object.keys(filesPerPackage).sort();

if (asCheck) {
	const over = Object.entries(CEILING).flatMap(([pkg, ceiling]) => {
		const found = PATTERNS.reduce((sum, { name }) => sum + (counts[name].byPackage[pkg] ?? 0), 0);
		if (found <= ceiling) return [];
		const files = PATTERNS.flatMap(({ name }) =>
			Object.entries(counts[name].byFile)
				.filter(([file]) => packageOf(path.join(root, file)) === pkg)
				.map(([file, n]) => `    ${name}: ${file} (${n})`),
		);
		return [
			`${pkg}: ${found} weak test patterns, at most ${ceiling}. Fix the new one, or add it to EXEMPT with its reason.`,
			...files,
		];
	});
	for (const line of over) console.error(line);
	if (over.length) process.exit(1);
	console.log(`weak-patterns: ok (${Object.keys(CEILING).join(", ")})`);
} else if (asJson) {
	const top = (byFile) =>
		Object.entries(byFile)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([file, n]) => ({ file, n }));
	console.log(
		JSON.stringify(
			{
				files: testFiles.length,
				filesPerPackage,
				linesPerPackage,
				patterns: PATTERNS.map(({ name, why }) => ({
					name,
					why,
					total: counts[name].total,
					exempt: counts[name].exempt,
					files: Object.keys(counts[name].byFile).length,
					byPackage: counts[name].byPackage,
					top: top(counts[name].byFile),
				})),
			},
			null,
			2,
		),
	);
} else {
	const head = ["pattern", "total", "exempt", "files", ...packages];
	const rows = PATTERNS.map(({ name }) => [
		name,
		counts[name].total,
		counts[name].exempt,
		Object.keys(counts[name].byFile).length,
		...packages.map((pkg) => counts[name].byPackage[pkg] ?? 0),
	]);
	const widths = head.map((cell, i) => Math.max(String(cell).length, ...rows.map((row) => String(row[i]).length)));
	const line = (row) =>
		row
			.map((cell, i) =>
				String(cell)
					.padStart(i === 0 ? 0 : widths[i])
					.padEnd(i === 0 ? widths[i] : 0),
			)
			.join("  ");
	console.log(`${testFiles.length} test files`);
	console.log(line(head));
	for (const row of rows) console.log(line(row));
}
