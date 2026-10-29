#!/usr/bin/env node
/**
 * Counts the tests that name the reference blog's config as it is: a collection, field, block or locale that the blog test config
 * (`packages/core/test/cms.config.ts`) has and the other-site config (`other-site.config.ts`) does not, written as a string in a test that runs
 * on the shared test site. Such a test breaks, or checks nothing, on another site's config; looking the name up (`test/any-site.ts`) keeps it
 * working on both. Not counted: `*.blog.test.ts` (blog-only by name), tests that build a site config of their own and never touch the shared
 * one, and names inside `ByRole(...)` (a `tab` role is not the `tab` block).
 *
 *   node scripts/test-metrics/site-names.mjs          # table per package, with the names met most
 *   node scripts/test-metrics/site-names.mjs --json   # the same as JSON, with the count per file (`byFile`)
 *   node scripts/test-metrics/site-names.mjs --check  # fails when a package whose tests were overhauled has more than its `CEILING` (CI)
 *
 * The two configs are TypeScript with imports across packages, so they are loaded through Vite, as the test runner loads them.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const asJson = process.argv.includes("--json");
const asCheck = process.argv.includes("--check");

/**
 * The most blog names a package whose tests were overhauled may write: the uses it was left with, each read and kept for a reason (a name in a
 * config the test builds, an admin language that is not a site locale). CI fails above it. Lower it when uses are fixed.
 */
const CEILING = { core: 0 };

const loadConfigs = async () => {
	const server = await createServer({
		root,
		configFile: false,
		logLevel: "error",
		appType: "custom",
		server: { middlewareMode: true, hmr: false },
		resolve: { alias: [{ find: "server-only", replacement: path.join(root, "packages/core/test/server-only.ts") }] },
	});
	try {
		const load = async (file) => (await server.ssrLoadModule(path.join(root, file))).default;
		return {
			blog: await load("packages/core/test/cms.config.ts"),
			other: await load("packages/core/test/other-site.config.ts"),
		};
	} finally {
		await server.close();
	}
};

/** The names a config gives, by kind. */
const namesOf = (config) => ({
	collection: Object.keys(config.collections ?? {}),
	field: [
		...new Set(Object.values(config.collections ?? {}).flatMap((collection) => Object.keys(collection.fields ?? {}))),
	],
	block: (config.blocks ?? []).map((block) => block.name ?? block.component).filter(Boolean),
	locale: (config.locales ?? []).map((locale) => locale.code ?? locale),
});

const { blog, other } = await loadConfigs();
const blogNames = namesOf(blog);
const otherNames = namesOf(other);
const otherAll = new Set(Object.values(otherNames).flat());
/** Name → kind, for the blog's names that the other site does not have. */
const blogOnly = new Map(
	Object.entries(blogNames).flatMap(([kind, names]) =>
		names.filter((name) => !otherAll.has(name)).map((name) => [name, kind]),
	),
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

// The shared test site: the core helpers, and the admin helpers that render with it.
const SHARED =
	/test\/site["']|test\/cms\.config["']|any-site|\btestSite\b|\btestConfig\b|src\/test\/(?:site|router|block-editor|schema-story-api)["']/;
const LITERAL = /["'`]([A-Za-z][\w-]*)["'`]/g;

const byPackage = {};
const perName = {};
/** File → the blog names it writes, for `--json`. */
const byFile = {};
for (const file of files) {
	const rel = path.relative(root, file);
	if (rel.startsWith("packages/ui/visual/") || /\.blog\.test\.[jt]sx?$/.test(rel)) continue;
	const text = readFileSync(file, "utf8");
	if (!SHARED.test(text)) continue;
	const pkg = rel.split(path.sep)[1];
	byPackage[pkg] ??= { sharedFiles: 0, filesNamingBlog: 0, literals: 0, byKind: {} };
	const row = byPackage[pkg];
	row.sharedFiles += 1;
	let found = 0;
	for (const line of text.replace(/ByRole\([^)]*\)/g, "").split("\n")) {
		for (const match of line.matchAll(LITERAL)) {
			const kind = blogOnly.get(match[1]);
			if (!kind) continue;
			found += 1;
			row.byKind[kind] = (row.byKind[kind] ?? 0) + 1;
			perName[match[1]] = (perName[match[1]] ?? 0) + 1;
		}
	}
	if (found) {
		row.filesNamingBlog += 1;
		byFile[rel] = found;
	}
	row.literals += found;
}

const topNames = Object.entries(perName)
	.sort((a, b) => b[1] - a[1])
	.slice(0, 15);

if (asCheck) {
	const over = Object.entries(CEILING).flatMap(([pkg, ceiling]) => {
		const found = byPackage[pkg]?.literals ?? 0;
		if (found <= ceiling) return [];
		const files = Object.entries(byFile)
			.filter(([file]) => file.startsWith(`packages/${pkg}/`))
			.map(([file, n]) => `    ${file} (${n})`);
		return [
			`${pkg}: ${found} reference blog names in shared-site tests, at most ${ceiling}. Look the name up from the config.`,
			...files,
		];
	});
	for (const line of over) console.error(line);
	if (over.length) process.exit(1);
	console.log(`site-names: ok (${Object.keys(CEILING).join(", ")})`);
} else if (asJson) {
	console.log(JSON.stringify({ blogOnly: Object.fromEntries(blogOnly), byPackage, topNames, byFile }, null, 2));
} else {
	console.log(`blog-only names: ${[...blogOnly].map(([name, kind]) => `${name} (${kind})`).join(", ")}`);
	console.log("\npackage            shared files  naming the blog  names  by kind");
	for (const [pkg, row] of Object.entries(byPackage).sort((a, b) => b[1].literals - a[1].literals))
		console.log(
			`${pkg.padEnd(18)} ${String(row.sharedFiles).padStart(12)}  ${String(row.filesNamingBlog).padStart(15)}  ${String(row.literals).padStart(5)}  ${JSON.stringify(row.byKind)}`,
		);
	console.log(`\nnames met most: ${topNames.map(([name, n]) => `${name} ${n}`).join(", ")}`);
}
