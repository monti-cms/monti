#!/usr/bin/env node
// The scenes of `testing/scenes.ts` are tried wherever their kind of part is used, and no test is left unrun without a reason.
//
//   node scripts/check-scenes.mjs           check, exit 1 with what is missing and how to fix it
//   node scripts/check-scenes.mjs --hook    a Claude Code PreToolUse hook: the same check before `git push` and `gh pr create`
//   node scripts/check-scenes.mjs --notice  a Claude Code Stop hook: says what is missing, stops nothing
//
// What it reads (the files are parsed, so a call in a comment is not a test, and a test inside a skipped `describe` is skipped):
// - admin: a folder of `packages/admin/src` whose code takes a part of a kind from `@monti-cms/ui` (or holds the kind's own admin code) has, in its
//   tests, one for each of the kind's `admin` scenes, named by the scene: `it("[reach] …")`.
// - ui: each of a kind's `ui` scenes has a test in a `*.browser.test.tsx` of `packages/ui` that takes one of the kind's parts.
// - every test: no `.todo`, no `.only`; a `.skip` names the tracker item it waits for (`T123`) in its title.
// - a `[tag]` in a test's title is a scene of the list.
//
// What it cannot check:
// - that a test does what its scene says. It reads the title, so the review reads the test.
// - which part of a folder a test tries: a folder's scene is met by any test of that folder that names it.
// - a part that reaches a screen through another module's re-export: only an import from `@monti-cms/ui` itself is a use.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { commandsOf } from "./merge-commands.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The parser is taken in a way that can fail without ending the script: a hook that cannot run must hold its call (exit 2), not let it through.
let parseSync = () => {
	throw new Error("oxc-parser is not installed (pnpm install)");
};
try {
	({ parseSync } = await import("oxc-parser"));
} catch {
	// Said when a file is read.
}

const TAG = /\[([a-z][a-z-]*)\]/g;
const TRACKED = /\bT\d+\b/;
const CALLERS = new Set(["it", "test", "describe"]);
/** Called this way, a test or a suite does not run. */
const UNRUN = new Set(["skip", "todo", "fixme"]);

/** The names of a callee read from its root: `it.skip.each` is `["it", "skip", "each"]`. Calls on the way (`it.each([…])`) are passed through. */
function chainOf(callee) {
	if (callee.type === "CallExpression") return chainOf(callee.callee);
	if (callee.type === "TaggedTemplateExpression") return chainOf(callee.tag);
	if (callee.type === "Identifier") return [callee.name];
	if (callee.type === "MemberExpression" && !callee.computed) {
		const before = chainOf(callee.object);
		return before ? [...before, callee.property.name] : null;
	}
	return null;
}

/** A title written as a string or a template (what stands in `${…}` reads as "…"). Anything else is not a title. */
function titleOf(node) {
	if (node?.type === "Literal" && typeof node.value === "string") return node.value;
	if (node?.type === "TemplateLiteral") return node.quasis.map((quasi) => quasi.value.cooked ?? "").join("…");
	return null;
}

/**
 * What a file says: its tests and suites (how each is called, its title, whether it runs) and the names it imports.
 * @returns {{ calls: { suite: boolean, names: string[], title: string, runs: boolean, line: number }[], imports: { name: string, from: string }[] } | null}
 *   `null` when the file cannot be parsed.
 */
function read(file, text) {
	const { program, errors } = parseSync(file, text);
	if (errors.length > 0) return null;
	const calls = [];
	const imports = [];
	const lineAt = (offset) => text.slice(0, offset).split("\n").length;
	const walk = (node, runs) => {
		if (!node || typeof node !== "object") return;
		if (Array.isArray(node)) {
			for (const each of node) walk(each, runs);
			return;
		}
		if (typeof node.type !== "string") return;
		if (node.type === "ImportDeclaration") {
			if (node.importKind !== "type")
				for (const specifier of node.specifiers)
					if (specifier.type === "ImportSpecifier" && specifier.importKind !== "type")
						imports.push({ name: specifier.imported.name ?? specifier.imported.value, from: node.source.value });
			return;
		}
		let inside = runs;
		if (node.type === "CallExpression") {
			const names = chainOf(node.callee);
			const title = titleOf(node.arguments[0]);
			if (names && CALLERS.has(names[0]) && (title !== null || names.includes("only"))) {
				const suite = names.includes("describe");
				inside = runs && !names.some((name) => UNRUN.has(name));
				calls.push({ suite, names: names.slice(1), title: title ?? "", runs: inside, line: lineAt(node.start) });
			}
		}
		for (const key of Object.keys(node)) if (key !== "type") walk(node[key], inside);
	};
	walk(program, true);
	return { calls, imports };
}

/**
 * What is wrong in these files.
 * @param {{ scenes: Record<string, { does: string }>, kinds: Record<string, { parts: string[], adminCode?: string[], ui: string[], admin: string[] }>, files: Record<string, string> }} input
 *   `files`: repository paths to their text.
 * @returns {string[]} one line for each thing wrong
 */
export function problems({ scenes, kinds, files }) {
	const found = [];
	const paths = Object.keys(files).sort();
	const isTest = (file) => /\.test\.tsx?$|\.e2e\.ts$/.test(file);
	const isAdmin = (file) => file.startsWith("packages/admin/src/");
	const adminSource = paths.filter((file) => isAdmin(file) && !isTest(file) && !file.endsWith(".stories.tsx"));
	const adminTests = paths.filter((file) => isAdmin(file) && isTest(file));
	const partTests = paths.filter((file) => file.startsWith("packages/ui/src/") && file.endsWith(".browser.test.tsx"));

	const parsed = {};
	for (const file of new Set([...paths.filter(isTest), ...adminSource])) {
		parsed[file] = read(file, files[file]);
		if (!parsed[file]) found.push(`${file}: the file cannot be parsed, so its tests cannot be read. Fix its syntax.`);
	}
	const calls = (file) => parsed[file]?.calls ?? [];
	const scenesOf = (title) => [...title.matchAll(TAG)].map((tag) => tag[1]);
	/** The scenes a file's tests try: a suite's title names nothing, and a test that does not run tries nothing. */
	const tried = (file) =>
		calls(file)
			.filter((call) => !call.suite && call.runs)
			.flatMap((call) => scenesOf(call.title));

	for (const file of paths.filter(isTest))
		for (const call of calls(file)) {
			const at = `${file}:${call.line}`;
			if (call.names.includes("todo"))
				found.push(`${at}: "${call.title}" is still to do. Write the test, or take the line out.`);
			if (call.names.includes("only"))
				found.push(`${at}: ".only" keeps every other test of the file from running. Take it off.`);
			if (call.names.some((name) => name === "skip" || name === "fixme") && !TRACKED.test(call.title))
				found.push(
					`${at}: "${call.title}" is skipped without a reason. Run it, or add the item of docs/tracker.md it waits for to its title ("… (T123)").`,
				);
			for (const scene of scenesOf(call.title)) {
				if (!(scene in scenes))
					found.push(
						`${at}: [${scene}] is not a scene of testing/scenes.ts. Use a scene's name, or write the words without brackets.`,
					);
				else if (call.suite)
					found.push(
						`${at}: [${scene}] names a suite. A scene is one test: put it in the title of the it() that tries it.`,
					);
			}
		}

	for (const [kind, { parts, adminCode = [], ui, admin }] of Object.entries(kinds)) {
		// admin: folder by folder.
		const users = new Map();
		for (const file of adminSource) {
			const taken = (parsed[file]?.imports ?? [])
				.filter((each) => each.from === "@monti-cms/ui")
				.map((each) => each.name);
			const made = adminCode.filter((name) => new RegExp(`\\b(?:function|const)\\s+${name}\\b`).test(files[file]));
			const uses = [...parts.filter((part) => taken.includes(part)), ...made];
			if (uses.length === 0) continue;
			const folder = path.dirname(file);
			users.set(folder, [...(users.get(folder) ?? []), ...uses.map((name) => `${name} in ${path.basename(file)}`)]);
		}
		for (const [folder, uses] of users) {
			const here = new Set(adminTests.filter((file) => path.dirname(file) === folder).flatMap(tried));
			for (const scene of admin)
				if (!here.has(scene))
					found.push(
						`${folder}: no test of [${scene}] (kind ${kind}: ${uses[0]}). Add it("[${scene}] …") to a test in that folder (*.screen.test.tsx): ${scenes[scene].does}`,
					);
		}
		// ui: once for the kind, in a test that takes one of its parts.
		const onParts = partTests.filter((file) => (parsed[file]?.imports ?? []).some((each) => parts.includes(each.name)));
		const here = new Set(onParts.flatMap(tried));
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

/** The flags of `git` and of `gh` that stand before the subcommand and take the next word. */
const TAKES_VALUE = new Set([
	"-C",
	"-c",
	"--git-dir",
	"--work-tree",
	"--namespace",
	"--exec-path",
	"-R",
	"--repo",
	"--hostname",
]);

/** Whether a command line sends work out: a `git push` or a `gh pr create` among its commands, whatever flags stand between the words. */
export function sendsOut(commandLine) {
	return commandsOf(commandLine).some((words) => {
		const at = words.findIndex((word) => /(^|\/)(git|gh)$/.test(word));
		if (at < 0) return false;
		const rest = [];
		for (let index = at + 1; index < words.length; index++) {
			const word = words[index];
			if (TAKES_VALUE.has(word)) index++;
			else if (!word.startsWith("-")) rest.push(word);
		}
		return words[at].endsWith("git") ? rest[0] === "push" : rest[0] === "pr" && rest[1] === "create";
	});
}

async function main() {
	const mode = process.argv[2];
	if (mode === "--hook") {
		// Only the calls that send work out; anything else, and a call that cannot be read, goes through.
		let command = "";
		try {
			command = JSON.parse(readFileSync(0, "utf8")).tool_input?.command ?? "";
		} catch {
			return;
		}
		if (typeof command !== "string" || !sendsOut(command)) return;
		// A check that cannot run holds the push as a failed one does: exit 2 is the code that stops the call.
		let said;
		try {
			const found = await check();
			if (found.length === 0) return;
			said = report(found);
		} catch (error) {
			said = `check:scenes could not run, so this call is held: ${error?.message ?? error}\n`;
		}
		process.stderr.write(said);
		process.exit(2);
	}
	if (mode === "--notice") {
		let said = "";
		try {
			const found = await check();
			if (found.length > 0) said = report(found);
		} catch (error) {
			said = `check:scenes could not run: ${error?.message ?? error}`;
		}
		if (said) process.stdout.write(`${JSON.stringify({ systemMessage: said })}\n`);
		return;
	}
	const found = await check();
	if (found.length === 0) return void console.log("check:scenes: every scene is tried where its kind is used.");
	process.stderr.write(report(found));
	process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
