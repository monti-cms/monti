#!/usr/bin/env node
// The fence around worker agents.
//
//   node agent-guard/check.mjs --stop        Stop hook (Claude Code, Codex, Antigravity): reads the hook payload on stdin
//   node agent-guard/check.mjs --pre-commit  Git pre-commit hook
//   node agent-guard/check.mjs               run the code checks (`pnpm lint` and the acceptance fence) and exit 0 or 1
//
// Only worker sessions are checked: a delegated task (`T3CODE_THREAD_ID`) or a sub-agent (`agent_id` in the payload).
// The PM and the owner are never stopped by it. Anything unexpected inside the check fails open with a warning.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const WORKER_THREAD_PREFIX = "thread:delegated-task:";
const MAX_FAILURES = 3;
const LINT_TIMEOUT_MS = Number(process.env.MONTI_CHECK_TIMEOUT_MS) || 120_000;
const OUTPUT_TAIL_LINES = 40;
const MAX_PROBLEMS = 40;
const MAX_BUFFER = 256 * 1024 * 1024;

// A worker may not change these; they define the task and the rules it is checked against.
const PROTECTED_PREFIXES = ["docs/acceptance/", "agent-guard/", ".husky/", "packages/core/biome-plugins/"];
const PROTECTED_FILES = new Set([
	".claude/settings.json",
	".codex/hooks.json",
	".agents/hooks.json",
	".gemini/settings.json",
	"packages/core/biome.json",
	"packages/core/.dependency-cruiser.cjs",
]);

// A change to one of these is what `pnpm lint` has to look at.
const CODE_PREFIXES = ["packages/", "scripts/"];
const CODE_FILE_NAMES = new Set(["package.json", "pnpm-lock.yaml", "biome.json"]);

const FIX_AND_RETRY = "Fix these and try to finish again.";
const ESCALATION =
	"The check failed 3 times in a row. Stop fixing. Report the failing check and its output to the PM, word for word, and do not commit or push. If an acceptance condition looks wrong, say so in the report; do not change anything to get around the check.";

const isProtected = (file) => PROTECTED_FILES.has(file) || PROTECTED_PREFIXES.some((prefix) => file.startsWith(prefix));

const isCode = (file) => {
	const name = path.posix.basename(file);
	return (
		CODE_PREFIXES.some((prefix) => file.startsWith(prefix)) ||
		CODE_FILE_NAMES.has(name) ||
		/^tsconfig.*\.json$/.test(name)
	);
};

const isWorkerThread = () => process.env.T3CODE_THREAD_ID?.startsWith(WORKER_THREAD_PREFIX) === true;

const sha256 = (...parts) => {
	const hash = createHash("sha256");
	for (const part of parts) hash.update(part);
	return hash.digest("hex");
};

/** Runs git in `cwd` and returns stdout. Paths in its output are then relative to the repository root. */
function git(cwd, args) {
	const result = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: MAX_BUFFER });
	if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.error?.message}`);
	return result.stdout;
}

const splitNul = (output) => output.split("\0").filter(Boolean);

// `--no-renames` lists both sides of a move, so moving a file out of a protected path is still seen.
const trackedChanges = (root) => splitNul(git(root, ["diff", "--name-only", "-z", "--no-renames", "HEAD", "--"]));
const untrackedFiles = (root) => splitNul(git(root, ["ls-files", "-z", "--others", "--exclude-standard"]));

/** One hash for everything `pnpm lint` can see: HEAD, the diff against it and the untracked files that are not ignored. */
function fingerprint(root, untracked) {
	const hash = createHash("sha256");
	hash.update(git(root, ["rev-parse", "HEAD"]));
	hash.update(git(root, ["diff", "--binary", "--no-renames", "HEAD", "--"]));
	for (const file of untracked) {
		let content;
		try {
			content = readFileSync(path.join(root, file));
		} catch {
			content = "unreadable";
		}
		hash.update(`\0${file}\0${sha256(content)}`);
	}
	return hash.digest("hex");
}

/**
 * The environment for `pnpm lint`. A fresh git worktree has no `node_modules` until it is installed, and without it pnpm
 * falls back to whatever biome is installed globally. The main checkout's `.bin` folders come first on PATH instead, so
 * the lint runs the pinned versions. Nothing changes when the worktree has its own `node_modules`.
 */
function lintEnv(root) {
	if (existsSync(path.join(root, "node_modules"))) return process.env;
	let common;
	try {
		common = path.resolve(root, git(root, ["rev-parse", "--git-common-dir"]).trim());
	} catch {
		return process.env;
	}
	const mainRoot = path.basename(common) === ".git" ? path.dirname(common) : common;
	const bins = [
		path.join(mainRoot, "node_modules", ".bin"),
		path.join(mainRoot, "packages", "core", "node_modules", ".bin"),
	].filter((dir) => existsSync(dir));
	if (bins.length === 0) return process.env;
	const key = Object.keys(process.env).find((name) => name.toUpperCase() === "PATH") ?? "PATH";
	return { ...process.env, [key]: [...bins, process.env[key]].filter(Boolean).join(path.delimiter) };
}

/** Runs `pnpm lint` in its own process group so the timeout can kill biome and the rest with it. */
function runLint(root) {
	return new Promise((resolve, reject) => {
		const windows = process.platform === "win32";
		const child = spawn("pnpm", ["lint"], {
			cwd: root,
			env: lintEnv(root),
			detached: !windows,
			shell: windows,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let output = "";
		const collect = (chunk) => {
			output += chunk;
		};
		child.stdout.setEncoding("utf8").on("data", collect);
		child.stderr.setEncoding("utf8").on("data", collect);
		const timer = setTimeout(() => {
			try {
				if (windows) child.kill("SIGKILL");
				else process.kill(-child.pid, "SIGKILL");
			} catch {}
			child.stdout.destroy();
			child.stderr.destroy();
			reject(new Error(`pnpm lint did not finish in ${LINT_TIMEOUT_MS / 1000}s`));
		}, LINT_TIMEOUT_MS);
		child.on("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			resolve({ ok: code === 0, output });
		});
	});
}

const tail = (text) => text.trimEnd().split("\n").slice(-OUTPUT_TAIL_LINES).join("\n");

/** The core's tests against the acceptance conditions (fence.mjs). Loaded when needed, so a missing TypeScript only skips the hooks. */
async function runFence(root) {
	const { checkFence } = await import("./fence.mjs");
	return checkFence(root);
}

function fenceDetail(problems) {
	const shown = problems.slice(0, MAX_PROBLEMS).map((problem) => `- ${problem}`);
	if (problems.length > MAX_PROBLEMS) shown.push(`...and ${problems.length - MAX_PROBLEMS} more`);
	return `The acceptance fence failed:\n${shown.join("\n")}`;
}

// The per-session state: how many checks in a row failed, and the working tree that last passed.
const EMPTY_STATE = { failureCount: 0, escalated: false, lastPassingFingerprint: null };

const stateFile = (key) => path.join(tmpdir(), `monti-check-${sha256(key)}.json`);

function loadState(file) {
	try {
		return { ...EMPTY_STATE, ...JSON.parse(readFileSync(file, "utf8")) };
	} catch {
		return { ...EMPTY_STATE };
	}
}

function saveState(file, state) {
	const temporary = `${file}.${process.pid}.tmp`;
	writeFileSync(temporary, JSON.stringify(state));
	renameSync(temporary, file);
}

/**
 * Decides whether a worker may stop. Returns the reason to keep it working, or null to let it stop.
 * State is kept per session, so the third failure in a row ends the loop.
 */
async function evaluate(root, key) {
	const file = stateFile(key);
	const state = loadState(file);

	// The failure that escalated has been reported; the next stop is free, whatever the tree looks like.
	if (state.escalated) {
		saveState(file, { ...state, failureCount: 0, escalated: false });
		return null;
	}

	const untracked = untrackedFiles(root);
	const changed = [...trackedChanges(root), ...untracked];

	const touched = [...new Set(changed.filter(isProtected))];
	if (touched.length > 0) {
		return fail(
			file,
			state,
			[
				"Protected files were changed:",
				...touched.map((name) => `- ${name}`),
				"",
				"Do not change them. Restore them (`git checkout HEAD -- <file>` for tracked files, delete the ones you added) and solve the task in files you may change.",
				"If an acceptance condition or a rule itself looks wrong, restore the files and report it to the PM.",
			].join("\n"),
		);
	}

	if (!changed.some(isCode)) {
		saveState(file, { ...state, failureCount: 0, escalated: false });
		return null;
	}

	const current = fingerprint(root, untracked);
	if (current === state.lastPassingFingerprint) {
		saveState(file, { ...state, failureCount: 0, escalated: false });
		return null;
	}

	const problems = await runFence(root);
	const lint = await runLint(root);
	if (lint.ok && problems.length === 0) {
		saveState(file, { failureCount: 0, escalated: false, lastPassingFingerprint: current });
		return null;
	}
	const details = [];
	if (!lint.ok) details.push(`\`pnpm lint\` failed:\n${tail(lint.output)}`);
	if (problems.length > 0) details.push(fenceDetail(problems));
	return fail(file, state, details.join("\n\n"));
}

function fail(file, state, detail) {
	const failureCount = state.failureCount + 1;
	const escalated = failureCount >= MAX_FAILURES;
	saveState(file, { ...state, failureCount, escalated });
	return `${detail}\n\n${escalated ? ESCALATION : FIX_AND_RETRY}`;
}

async function readPayload() {
	if (process.stdin.isTTY) return {};
	process.stdin.setEncoding("utf8");
	let text = "";
	for await (const chunk of process.stdin) text += chunk;
	if (text.trim() === "") return {};
	const payload = JSON.parse(text);
	if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
		throw new Error("the hook payload is not a JSON object");
	}
	return payload;
}

async function stop() {
	const payload = await readPayload();
	const worker = isWorkerThread() || (typeof payload.agent_id === "string" && payload.agent_id !== "");
	if (!worker) return 0;

	// Antigravity runs the hook after every step; only the end of a whole run (`fullyIdle`) is a stop.
	const antigravity = Object.hasOwn(payload, "executionNum");
	if (antigravity && payload.fullyIdle !== true) return 0;

	const root = topLevel();
	const session = payload.session_id ?? payload.sessionId ?? payload.conversationId ?? process.env.T3CODE_THREAD_ID;
	const reason = await evaluate(root, [session ?? root, payload.agent_id ?? ""].join("|"));

	if (antigravity) {
		process.stdout.write(`${JSON.stringify(reason ? { decision: "continue", reason } : { decision: "stop" })}\n`);
		return 0;
	}
	if (reason) {
		process.stderr.write(`${reason}\n`);
		return 2;
	}
	return 0;
}

const topLevel = () => git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();

async function preCommit() {
	const root = topLevel();
	const worker = isWorkerThread();
	const staged = splitNul(git(root, ["diff", "--cached", "--name-only", "-z", "--no-renames"]));

	// The owner and the PM commit the protected files; a worker's commit may not contain them.
	const protectedFiles = worker ? staged.filter(isProtected) : [];
	if (protectedFiles.length > 0) {
		process.stderr.write(
			`Protected files are staged:\n${protectedFiles.map((name) => `- ${name}`).join("\n")}\nUnstage and restore them (git restore --staged --worktree --source=HEAD -- <file>) and commit the rest.\n`,
		);
		return 1;
	}

	// A commit that touches the core must keep its tests matching the acceptance conditions; the owner's commit of the conditions alone is not held to it.
	const touchesCore = staged.some((file) => file.startsWith("packages/core/")) || (worker && staged.some(isCode));
	if (!touchesCore) return 0;
	const problems = await runFence(root);
	if (problems.length > 0) process.stderr.write(`${fenceDetail(problems)}\n`);
	return problems.length > 0 ? 1 : 0;
}

/** `pnpm lint` and the fence, both run so one report shows everything that is wrong. */
async function checkAll() {
	const root = topLevel();
	const lint = spawnSync("pnpm", ["lint"], {
		cwd: root,
		env: lintEnv(root),
		stdio: "inherit",
		shell: process.platform === "win32",
	});
	const problems = await runFence(root);
	if (problems.length > 0) process.stderr.write(`${fenceDetail(problems)}\n`);
	return lint.status === 0 && problems.length === 0 ? 0 : 1;
}

async function main() {
	const mode = process.argv[2];
	if (mode === undefined) {
		try {
			return await checkAll();
		} catch (error) {
			process.stderr.write(`agent-guard: the check could not run (${error.message})\n`);
			return 1;
		}
	}
	if (mode !== "--stop" && mode !== "--pre-commit") {
		process.stderr.write(`Unknown option ${mode}. Use --stop, --pre-commit or no option.\n`);
		return 1;
	}
	try {
		return mode === "--stop" ? await stop() : await preCommit();
	} catch (error) {
		process.stderr.write(`agent-guard: the check could not run and was skipped (${error.message})\n`);
		return 0;
	}
}

process.exitCode = await main();
