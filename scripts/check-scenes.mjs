#!/usr/bin/env node
// The scenes of `testing/scenes.ts` are tried wherever their kind of part is used, and no test is left unrun without a reason.
//
//   node scripts/check-scenes.mjs           check, exit 1 with what is missing and how to fix it
//   node scripts/check-scenes.mjs --hook    a Claude Code PreToolUse hook: the same check before `git push` and `gh pr create`
//   node scripts/check-scenes.mjs --notice  a Claude Code Stop hook: says what is missing, stops nothing
//
// What it reads:
// - admin: a folder of `packages/admin/src` whose code takes a part of a kind from `@monti-cms/ui` (or holds the kind's own admin code) has, in its
//   tests, one for each of the kind's `admin` scenes, named by the scene: `it("[reach] …")`.
// - ui: each of a kind's `ui` scenes has a test in a `*.browser.test.tsx` of `packages/ui` that tries one of the kind's parts.
// - every test: no `.todo`, no `.only`; a `.skip` names the tracker item it waits for (`T123`) in its title.
// - a `[tag]` in a test title is a scene of the list.
//
// What it cannot check: that a test does what its scene says. It reads the title, so the review reads the test.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const UI_IMPORT = /import\s+\{([^}]*)\}\s+from\s+"@monti-cms\/ui"/g;
const TEST_CALL = /\b(?:it|test|describe)((?:\.[A-Za-z]+(?:\([^)]*\))?)*)\(\s*(["'`])((?:\\.|(?!\2).)*)\2/g;
const TAG = /\[([a-z][a-z-]*)\]/g;
const TRACKED = /\bT\d+\b/;

/**
 * What is wrong in these files.
 * @param {{ scenes: Record<string, unknown>, kinds: Record<string, { parts: string[], adminCode?: string[], ui: string[], admin: string[] }>, files: Record<string, string> }} input
 *   `files`: repository paths to their text.
 * @returns {string[]} one line for each thing wrong
 */
export function problems({ scenes, kinds, files }) {
	const found = [];
	const paths = Object.keys(files).sort();
	const isTest = (file) => /\.test\.tsx?$|\.e2e\.ts$/.test(file);

	/** The tests of a file: how each is called (`.skip`, `.todo`) and its title's scenes. */
	const tests = (file) =>
		[...files[file].matchAll(TEST_CALL)].map((call) => ({
			modifiers: call[1],
			title: call[3],
			scenes: [...call[3].matchAll(TAG)].map((tag) => tag[1]),
			line: files[file].slice(0, call.index).split("\n").length,
		}));
	/** The scenes a file's tests try: a test that is skipped or to do tries nothing. */
	const tried = (file) =>
		new Set(
			tests(file)
				.filter((test) => !/\.(skip|todo)\b/.test(test.modifiers))
				.flatMap((test) => test.scenes),
		);

	for (const file of paths.filter(isTest))
		for (const test of tests(file)) {
			const at = `${file}:${test.line}`;
			if (/\.todo\b/.test(test.modifiers))
				found.push(`${at}: "${test.title}" is still to do. Write the test, or take the line out.`);
			if (/\.only\b/.test(test.modifiers))
				found.push(`${at}: ".only" keeps every other test of the file from running. Take it off.`);
			if (/\.skip\b/.test(test.modifiers) && !TRACKED.test(test.title))
				found.push(
					`${at}: "${test.title}" is skipped without a reason. Run it, or add the item of docs/tracker.md it waits for to its title ("… (T123)").`,
				);
			for (const scene of test.scenes)
				if (!(scene in scenes))
					found.push(
						`${at}: [${scene}] is not a scene of testing/scenes.ts. Use a scene's name, or write the words without brackets.`,
					);
		}

	const adminSource = paths.filter(
		(file) =>
			file.startsWith("packages/admin/src/") && /\.tsx?$/.test(file) && !isTest(file) && !file.endsWith(".stories.tsx"),
	);
	const adminTests = paths.filter((file) => file.startsWith("packages/admin/src/") && isTest(file));
	const partTests = paths.filter((file) => file.startsWith("packages/ui/src/") && file.endsWith(".browser.test.tsx"));
	const word = (name) => new RegExp(`\\b${name}\\b`);

	for (const [kind, { parts, adminCode = [], ui, admin }] of Object.entries(kinds)) {
		// admin: folder by folder.
		const users = new Map();
		for (const file of adminSource) {
			const taken = [...files[file].matchAll(UI_IMPORT)].flatMap((found) =>
				found[1]
					.split(",")
					.map((name) => name.trim())
					.filter((name) => !name.startsWith("type ")),
			);
			const made = adminCode.filter((name) => new RegExp(`\\b(?:function|const)\\s+${name}\\b`).test(files[file]));
			const uses = [...parts.filter((part) => taken.includes(part)), ...made];
			if (uses.length === 0) continue;
			const folder = path.dirname(file);
			users.set(folder, [...(users.get(folder) ?? []), ...uses.map((name) => `${name} in ${path.basename(file)}`)]);
		}
		for (const [folder, uses] of users) {
			const here = new Set(
				adminTests.filter((file) => path.dirname(file) === folder).flatMap((file) => [...tried(file)]),
			);
			for (const scene of admin)
				if (!here.has(scene))
					found.push(
						`${folder}: no test of [${scene}] (kind ${kind}: ${uses[0]}). Add it("[${scene}] …") to a test in that folder (*.screen.test.tsx): ${scenes[scene].does}`,
					);
		}
		// ui: once for the kind, on one of its parts.
		const onParts = partTests.filter((file) => parts.some((part) => word(part).test(files[file])));
		const here = new Set(onParts.flatMap((file) => [...tried(file)]));
		for (const scene of ui)
			if (!here.has(scene))
				found.push(
					`packages/ui: no test of [${scene}] on a part of kind ${kind} (${parts.join(", ")}). Add it("[${scene}] …") to that part's *.browser.test.tsx: ${scenes[scene].does}`,
				);
	}
	return found;
}

/** The repository's tracked and new files under the folders the check reads. */
function repositoryFiles() {
	const listed = execFileSync(
		"git",
		["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "packages", "testing/e2e"],
		{ cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
	);
	const files = {};
	for (const file of listed.split("\0"))
		if (/^(packages\/[^/]+\/src|testing\/e2e)\/.*\.tsx?$/.test(file)) {
			try {
				files[file] = readFileSync(path.join(root, file), "utf8");
			} catch {
				// Deleted and not yet staged.
			}
		}
	return files;
}

async function check() {
	const { SCENES, KINDS } = await import(path.join(root, "testing/scenes.ts"));
	return problems({ scenes: SCENES, kinds: KINDS, files: repositoryFiles() });
}

const report = (found) =>
	`check:scenes: ${found.length} thing(s) to fix (testing/scenes.ts says what each scene is).\n${found.map((line) => `  ${line}`).join("\n")}\n`;

async function main() {
	const mode = process.argv[2];
	if (mode === "--hook") {
		// Only the two calls that send work out; anything else, and a call that cannot be read, goes through.
		let command = "";
		try {
			command = JSON.parse(readFileSync(0, "utf8")).tool_input?.command ?? "";
		} catch {
			return;
		}
		if (!/\bgit\s+push\b|\bgh\s+pr\s+create\b/.test(command)) return;
		const found = await check();
		if (found.length === 0) return;
		process.stderr.write(report(found));
		process.exit(2);
	}
	const found = await check();
	if (mode === "--notice") {
		if (found.length > 0) process.stdout.write(`${JSON.stringify({ systemMessage: report(found) })}\n`);
		return;
	}
	if (found.length === 0) return void console.log("check:scenes: every scene is tried where its kind is used.");
	process.stderr.write(report(found));
	process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
