#!/usr/bin/env node
/**
 * Lists the test files that are not named after the module they test (`docs/testing.md`, "파일"): a test sits in the `__test__` folder next to what
 * it tests and has its name (`lifecycle.ts` → `__test__/lifecycle.test.ts`), so a reader finds the tests of a module next to it, under its name.
 *
 *   node scripts/test-metrics/test-names.mjs          # every test file that breaks the rule, and the files kept by `ALLOWED`
 *   node scripts/test-metrics/test-names.mjs --check  # fails on a file that breaks the rule, or an `ALLOWED` entry that no longer holds (CI)
 *
 * A file `<dir>/__test__/<sub>/<base><suffix>` is named after its module when `<dir>/<sub>/<base>.ts(x)` or `<dir>/<sub>/<base>/index.ts(x)`
 * exists, or when `<dir>/<sub>` is a route folder (it holds `route.ts`) and `<base>` is `route` or the folder's name. The suffix gives the layer:
 * `.test.ts(x)`, `.int.test.ts`, `.dom.test.ts(x)`, `.browser.test.ts(x)`, with `.blog` before it for a test of the reference blog only.
 *
 * Only core is checked for now (`PACKAGES`); a package joins once its test files are renamed.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const asCheck = process.argv.includes("--check");

/** The packages whose test files follow the rule. */
const PACKAGES = ["core"];

/**
 * Test files that check something across many modules and so have no single module to be named after, with the reason. Paths are from the
 * repository root.
 */
const ALLOWED = [
	{
		file: "packages/core/src/__test__/errors-say-how-to-fix.test.ts",
		why: "checks that the errors of many modules (config, server, formats, the HTTP error handler) each say what, where and how to fix",
	},
	{
		file: "packages/core/src/adapters/postgres/__test__/store-contract.int.test.ts",
		why: "runs every suite of the store contract (`core/store/__test__/contract`) against the Postgres store",
	},
	{
		file: "packages/core/src/cms/__test__/two-instances.blog.test.ts",
		why: "two CMS instances side by side: their sites, stores, plugins and renders stay apart",
	},
	{
		file: "packages/core/src/services/__test__/any-site.int.test.ts",
		why: "the other-site guard: writes, duplicates, media references and the trash on whatever site config the run uses",
	},
	{
		file: "packages/core/src/cli/__test__/init-typecheck.int.test.ts",
		why: "type-checks a project `init` wrote against every package's sources; its own file, so the mutation run can leave it out (`vitest.mutation.config.ts`)",
	},
	{
		file: "packages/core/src/cli/__test__/write-regular-file.int.test.ts",
		why: "tests `scripts/write-regular-file.mjs`, a repository script outside any package",
	},
	{
		file: "packages/core/src/format/__test__/mdx-boundary.int.test.ts",
		why: "checks the published manifest (`packages/core/package.json`) has no MDX in it, which no source module holds",
	},
	{
		file: "packages/core/src/render/__test__/render-css.browser.test.ts",
		why: "checks the public stylesheet `packages/core/render.css`, which is not a source module",
	},
	// Each of these has one module, but the module's test file is on the other side of the per-file rules of the other-site run
	// (`test/config-sensitive.ts`) and of `site-names.mjs`: merged, the run would gain or lose tests, or names of the file's own config would count
	// as reference-blog names. They wait for those rules to work per `describe`.
	...[
		["packages/core/src/api-keys/__test__/api-key-slots.test.ts", "api-keys.test.ts", "reads the site config"],
		["packages/core/src/cms/__test__/plugin-context.test.ts", "create-cms.test.ts", "builds its own config"],
		[
			"packages/core/src/core/__test__/kind-and-required.test.ts",
			"collections.test.ts, snapshot.test.ts, fields.test.ts",
			"builds its own config",
		],
		["packages/core/src/core/__test__/list-query.test.ts", "api.test.ts", "builds its own config"],
		["packages/core/src/core/__test__/service-input.test.ts", "snapshot.test.ts", "builds its own config"],
		[
			"packages/core/src/render/__test__/document-keys.test.tsx",
			"document/__test__/render.test.tsx",
			"reads no config name",
		],
		[
			"packages/core/src/render/__test__/entry-links.test.tsx",
			"document/__test__/render.test.tsx",
			"reads no config name",
		],
	].map(([file, target, own]) => ({
		file,
		why: `belongs in ${target}, but it ${own}, unlike that file, so merging changes what the other-site run or site-names.mjs sees`,
	})),
];

const TEST = /\.test\.tsx?$/;
const SUFFIX = /(?:\.blog)?(?:\.int|\.dom|\.browser)?\.test\.tsx?$/;
const SOURCE_EXT = [".ts", ".tsx"];

const walk = (dir, out = []) => {
	for (const name of readdirSync(dir)) {
		// Dot folders: `.stryker-tmp` holds a copy of the sources while a mutation run is going.
		if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (TEST.test(name)) out.push(full);
	}
	return out;
};

/** Why a test file is not named after a module, or `undefined` when it is. */
const problemOf = (file) => {
	const parts = file.split(`${path.sep}__test__${path.sep}`);
	if (parts.length !== 2) return "is not in a `__test__` folder";
	const [moduleDir, rest] = parts;
	const name = path.basename(rest);
	if (!SUFFIX.test(name)) return "has no layer suffix";
	const base = name.replace(SUFFIX, "");
	const dir = path.join(moduleDir, path.dirname(rest));
	const exists = (file) => existsSync(file) && statSync(file).isFile();
	if (SOURCE_EXT.some((ext) => exists(path.join(dir, base + ext)))) return undefined;
	if (SOURCE_EXT.some((ext) => exists(path.join(dir, base, `index${ext}`)))) return undefined;
	if (exists(path.join(dir, "route.ts")) && (base === "route" || base === path.basename(dir))) return undefined;
	return `names no module next to its \`__test__\` folder (no ${path.relative(root, path.join(dir, base))}.ts)`;
};

const allowed = new Map(ALLOWED.map((entry) => [entry.file, entry.why]));
const broken = [];
const kept = [];
for (const pkg of PACKAGES) {
	for (const file of walk(path.join(root, "packages", pkg, "src"))) {
		const rel = path.relative(root, file).split(path.sep).join("/");
		const problem = problemOf(file);
		if (!problem) {
			if (allowed.has(rel)) broken.push(`${rel}: is named after a module now; remove it from ALLOWED`);
			continue;
		}
		if (allowed.has(rel)) kept.push(`${rel}: ${allowed.get(rel)}`);
		else broken.push(`${rel}: ${problem}`);
	}
}
for (const file of allowed.keys()) {
	if (!existsSync(path.join(root, file))) broken.push(`${file}: is in ALLOWED but does not exist`);
}

if (asCheck) {
	for (const line of broken) console.error(line);
	if (broken.length) {
		console.error(
			`test-names: ${broken.length} test file(s) not named after their module. Move the tests next to the module they test, under its name, ` +
				"or merge them into its test file (docs/testing.md, 파일); a file that checks many modules at once goes into ALLOWED with its reason.",
		);
		process.exit(1);
	}
	console.log(`test-names: ok (${PACKAGES.join(", ")}; ${kept.length} kept in ALLOWED)`);
} else {
	console.log(`Not named after a module (${broken.length}):`);
	for (const line of broken) console.log(`  ${line}`);
	console.log(`Kept by ALLOWED (${kept.length}):`);
	for (const line of kept) console.log(`  ${line}`);
}
