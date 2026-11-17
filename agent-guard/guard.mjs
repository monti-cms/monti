// A tool-call guard for AI coding agents: a pre-tool hook of Claude Code, Codex CLI, Gemini CLI and Antigravity. It reads the tool call as JSON
// on stdin and denies exactly three things:
//   1. `git commit` or `git push` with `--no-verify` or `-n`, `HUSKY=0`, and a `core.hooksPath` change;
//   2. a file edit that puts `biome-ignore`, `@ts-expect-error`, `@ts-nocheck` or `eslint-disable` into a file under `packages/core`;
//   3. a change to a lint-fence file (PROTECTED below): a file edit of it, or a shell command that names it and also writes (`>`, `tee`, `sed -i`,
//      `mv`, `cp`, `rm`). A command that only reads it passes.
// It fails closed: a call it cannot read is denied. A deny is exit code 2 with the reason on stderr; Antigravity reads a JSON decision from stdout.
// It is a guardrail, not a security boundary: other ways to write (an interpreter, a variable) are not seen. CI and review cover them.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROTECTED = ["packages/core/.dependency-cruiser.cjs", "packages/core/biome.json", ".claude/settings.json"];
const PROTECTED_FOLDERS = ["packages/core/biome-plugins", "agent-guard", ".codex", ".gemini", ".agents"];
const SUPPRESSION = /biome-ignore|@ts-expect-error|@ts-nocheck|eslint-disable/;
const STOP = "This is blocked on purpose. Do not look for another way around it: stop and ask the owner.";

class Denied extends Error {}
const deny = (reason) => {
	throw new Denied(`${reason} ${STOP}`);
};

// The strings of a tool's input, by what they are: the command, the file paths, the new text. The names differ by tool (`file_path`, `TargetFile`).
const COMMAND = /^(command|cmd|commandline)$/;
const PATH = /^(filepath|notebookpath|path|targetfile)$/;
const SKIPPED = /^(oldstring|targetcontent|description|instruction)$/;
function walk(value, key, found) {
	const name = key.toLowerCase().replaceAll("_", "");
	if (typeof value === "string") {
		if (COMMAND.test(name)) found.commands.push(value);
		else if (PATH.test(name)) found.paths.push(value);
		else if (name === "cwd") found.cwd = value;
		else if (!SKIPPED.test(name)) found.texts.push(value);
	} else if (Array.isArray(value)) {
		for (const item of value) walk(item, key, found);
	} else if (value !== null && typeof value === "object") {
		for (const [k, v] of Object.entries(value)) walk(v, k, found);
	}
}

function checkEdit(file, text, cwd) {
	// Both sides in lower case: a macOS path is case-insensitive, so `Packages/Core/Biome.json` is the same file.
	const rel = path.relative(ROOT.toLowerCase(), path.resolve(cwd, file).toLowerCase()).split(path.sep).join("/");
	if (PROTECTED.includes(rel) || PROTECTED_FOLDERS.some((folder) => rel === folder || rel.startsWith(`${folder}/`))) {
		deny(`\`${rel}\` holds the fence (lint rules, the dependency check, the agent hooks or this guard).`);
	}
	if (rel.startsWith("packages/core/") && SUPPRESSION.test(text)) {
		deny(`The new text for \`${rel}\` holds a lint or type suppression: the core is fixed, not silenced.`);
	}
}

// Codex `apply_patch` sends the whole patch as one string: `*** Update File: path` starts a file, and its added lines start with `+`.
function checkPatch(patch, cwd) {
	const edits = [];
	for (const line of patch.split("\n")) {
		const header = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/.exec(line) ?? /^\*\*\* Move to: (.+)$/.exec(line);
		if (header) edits.push({ file: header[1].trim(), text: "" });
		else if (line.startsWith("+") && edits.length > 0) edits.at(-1).text += `${line.slice(1)}\n`;
	}
	for (const { file, text } of edits) checkEdit(file, text, cwd);
}

function checkGit(command) {
	if (/\bHUSKY=["']?0\b/.test(command)) deny("`HUSKY=0` turns the git hooks off.");
	for (const segment of command.split(/&&|\|\||[;|\n]/)) {
		const words = segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
		if (words.find((word) => !/^\w+=/.test(word)) !== "git") continue;
		if (/core\.hookspath/i.test(segment)) deny("Changing `core.hooksPath` turns the git hooks off.");
		const skipsHooks = words.some((word) => word === "--no-verify" || /^-[a-z]*n[a-z]*$/.test(word));
		if (skipsHooks && words.some((word) => word === "commit" || word === "push")) {
			deny("`git commit` and `git push` run with their hooks: no `--no-verify`, no `-n`.");
		}
	}
}

function checkShell(command) {
	checkGit(command);
	// Quoted text and `2>&1` / `>/dev/null` are not writes: what is left is searched for a plain write signal.
	const bare = command.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""').replace(/\d*>&\d+|&?\d*>\s*\/dev\/null/g, "");
	const writes = /(?<![-=])>|\b(?:tee|mv|cp|rm)\b|\bsed\b[^|;&]*\s-[a-z]*i/.test(bare);
	if (writes && [...PROTECTED, ...PROTECTED_FOLDERS].some((name) => command.toLowerCase().includes(name))) {
		deny(
			"This command writes a file that holds the fence (lint rules, the dependency check, the agent hooks or this guard).",
		);
	}
}

function decide(input) {
	const payload = JSON.parse(input);
	const args = payload?.tool_input ?? payload?.toolCall?.args;
	if (args === null || typeof args !== "object") throw new Error("the call has no input to read");
	const name = String(payload.tool_name ?? payload.toolCall?.name ?? "");
	const found = { commands: [], paths: [], texts: [], cwd: undefined };
	walk(args, "", found);
	const cwd = path.resolve(found.cwd ?? payload.cwd ?? process.cwd());
	for (const command of found.commands) {
		if (name === "apply_patch") checkPatch(command, cwd);
		else checkShell(command);
	}
	if (/write|edit|replace|patch/i.test(name)) {
		for (const file of found.paths) checkEdit(file, found.texts.join("\n"), cwd);
	}
}

let input = "";
try {
	input = readFileSync(0, "utf8");
	decide(input);
} catch (error) {
	const reason =
		error instanceof Denied
			? error.message
			: `The call could not be checked (${error.message}), so it is denied. ${STOP}`;
	let antigravity = false;
	try {
		antigravity = "toolCall" in JSON.parse(input);
	} catch {
		process.stdout.write(`${JSON.stringify({ decision: "deny", reason })}\n`); // unreadable: say it in both ways
	}
	if (antigravity) process.stdout.write(`${JSON.stringify({ decision: "deny", reason })}\n`);
	else process.stderr.write(`${reason}\n`);
	process.exit(antigravity ? 0 : 2);
}
