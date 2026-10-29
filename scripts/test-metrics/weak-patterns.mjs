#!/usr/bin/env node
/**
 * Counts test code patterns that weaken a test or tie it to how the code is built, per package, so the suite can be measured before and after a
 * change. It only counts: nothing fails, and a count is not a verdict on any one line (a `querySelector` can be the right tool).
 *
 *   node scripts/test-metrics/weak-patterns.mjs              # table per pattern and package
 *   node scripts/test-metrics/weak-patterns.mjs --json       # the same as JSON, with the files that hold the most of each pattern
 *
 * Test code is every `*.test.*` / `*.spec.*` file under `packages/*` and every file in a `__test__` folder (shared suites and fixtures), except the
 * Playwright visual tests (`packages/ui/visual`). Names of the reference blog's config written in a test are counted by `site-names.mjs`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const asJson = process.argv.includes("--json");

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
		name: "korean-copy",
		why: "finds by Korean text written in the test instead of the message dictionary",
		regex: /name:\s*["'][^"'\n]*[가-힣]|By(?:Text|Label|Title|PlaceholderText)\(\s*["'][^"'\n]*[가-힣]/g, // cms-allow-korean: matches Hangul
	},
	{
		name: "source-read",
		why: "reads a file from disk (often source text checked with a regex)",
		regex: /readFileSync\(|readFile\(/g,
	},
];

const isTestFile = (file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) || file.split(path.sep).includes("__test__");

const files = [];
const walk = (dir) => {
	for (const name of readdirSync(dir)) {
		if (name === "node_modules" || name === "dist" || name === "storybook-static") continue;
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
const counts = Object.fromEntries(PATTERNS.map((pattern) => [pattern.name, { total: 0, byPackage: {}, byFile: {} }]));
const filesPerPackage = {};
const linesPerPackage = {};

for (const file of testFiles) {
	const pkg = packageOf(file);
	const rel = path.relative(root, file);
	const text = readFileSync(file, "utf8");
	filesPerPackage[pkg] = (filesPerPackage[pkg] ?? 0) + 1;
	linesPerPackage[pkg] = (linesPerPackage[pkg] ?? 0) + text.split("\n").length;
	for (const pattern of PATTERNS) {
		const found = text.match(pattern.regex)?.length ?? 0;
		if (!found) continue;
		const count = counts[pattern.name];
		count.total += found;
		count.byPackage[pkg] = (count.byPackage[pkg] ?? 0) + found;
		count.byFile[rel] = found;
	}
}

const packages = Object.keys(filesPerPackage).sort();

if (asJson) {
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
	const head = ["pattern", "total", "files", ...packages];
	const rows = PATTERNS.map(({ name }) => [
		name,
		counts[name].total,
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
