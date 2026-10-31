#!/usr/bin/env node
/**
 * Mutation testing of the lines a branch changed, so a change to 🔴 code can be checked without measuring whole files again
 * (`docs/testing.md`, "재기와 지키기"). It diffs the branch against its base, keeps the changed source lines of the packages that have a
 * Stryker setup (core, admin, auth), and runs each package's `test:mutation` on those lines only, with Stryker's incremental mode: the result
 * is kept in `reports/mutation/stryker-incremental.json` of the package, and a later run tests again only the mutants whose code or tests
 * changed since.
 *
 *   node scripts/test-metrics/mutation-changed.mjs                 # against origin/overhaul
 *   node scripts/test-metrics/mutation-changed.mjs --base main     # against another base
 *   node scripts/test-metrics/mutation-changed.mjs --dry           # print what it would run
 *
 * Tests, stories and test helpers are not mutated. Do not edit the package while it runs: Stryker writes its mutants into the files.
 */
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const arg = (name) => {
	const index = process.argv.indexOf(name);
	return index === -1 ? undefined : process.argv[index + 1];
};
const base = arg("--base") ?? "origin/overhaul";
const dry = process.argv.includes("--dry");

const PACKAGES = { core: "@monti-cms/core", admin: "@monti-cms/admin", auth: "@monti-cms/auth" };
const SOURCE = /^packages\/(core|admin|auth)\/(src\/.+\.tsx?)$/;
const NOT_SOURCE = /(__test__|\.test\.|\.stories\.|\.contract\.ts$|\/test\/)/;

const diff = execFileSync("git", ["diff", "--unified=0", "--no-color", `${base}...HEAD`, "--", "packages"], {
	cwd: root,
	encoding: "utf8",
	maxBuffer: 64 * 1024 * 1024,
});

/** `package` → `src/file.ts` → the line ranges the branch added or changed. */
const changed = new Map();
let file = null;
for (const line of diff.split("\n")) {
	if (line.startsWith("+++ ")) {
		const name = line.slice(4).replace(/^b\//, "");
		const match = SOURCE.exec(name);
		file = match && !NOT_SOURCE.test(name) ? { pkg: match[1], path: match[2] } : null;
		continue;
	}
	const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
	if (!hunk || !file) continue;
	const start = Number(hunk[1]);
	const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
	if (count === 0) continue;
	const files = changed.get(file.pkg) ?? new Map();
	changed.set(file.pkg, files);
	const ranges = files.get(file.path) ?? [];
	files.set(file.path, ranges);
	ranges.push(`${start}-${start + count - 1}`);
}

if (changed.size === 0) {
	console.log(`mutation-changed: no source line of core, admin or auth changed against ${base}`);
	process.exit(0);
}

let failed = false;
for (const [pkg, files] of changed) {
	const mutate = [...files].flatMap(([source, ranges]) => ranges.map((range) => `${source}:${range}`)).join(",");
	const args = [
		"--filter",
		PACKAGES[pkg],
		"test:mutation",
		"--ignoreStatic",
		"--incremental",
		"--incrementalFile",
		"reports/mutation/stryker-incremental.json",
		"--mutate",
		mutate,
		"--reporters",
		"clear-text,progress,html,json",
	];
	console.log(`mutation-changed: ${pkg}: ${files.size} file(s), ${mutate.split(",").length} range(s)`);
	if (dry) {
		console.log(`  pnpm ${args.join(" ")}`);
		continue;
	}
	const run = spawnSync("pnpm", args, { cwd: root, stdio: "inherit" });
	if (run.status !== 0) failed = true;
}
if (failed) process.exit(1);
