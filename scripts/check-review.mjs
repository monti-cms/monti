#!/usr/bin/env node
/**
 * Design review gate. The `design-review` agent (`.claude/agents/design-review.md`) reads every change to the admin UI before it joins a shared
 * branch (AGENTS.md). A rule that is only written down gets skipped: the trash's screens changed after their review and were merged unread
 * (#460). So the review leaves a record, `scripts/design-review.json`, and a commit whose admin UI is not the one on record fails.
 *
 *   node scripts/check-review.mjs            # fails if the admin UI at HEAD is not what the last review read; names the range to review
 *   node scripts/check-review.mjs <commit>   # the same for another commit (a pull request's head)
 *   node scripts/check-review.mjs --record   # the design-review agent's last step: records the admin UI at HEAD as read
 *   node scripts/check-review.mjs --hook     # Claude Code PreToolUse hook (.claude/settings.json): refuses `gh pr merge` of an unread head
 *
 * The admin UI is the files of `PATHS` without their tests (stories count: they are the states the review looks at). The record holds one hash
 * of those files' paths and contents, so a commit that only adds the record, or changes other code, keeps it valid, and a squash merge
 * carries it to the shared branch.
 *
 * It checks that the review ran on this code, not what the review saw. Nothing here stops a record written without a review; the agent's last
 * step is the only place that writes one.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RECORD = "scripts/design-review.json";
const PATHS = ["packages/ui/src", "packages/ui/styles", "packages/ui/tokens", "packages/admin/src"];
const TEST = /(^|\/)__test__\/|\.test\.[^/]+$/;

const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const attempt = (run) => {
	try {
		return run();
	} catch {
		return undefined;
	}
};
const short = (commit) => git("rev-parse", "--short", commit).trim();

/** The admin UI's files at a commit: path to blob id. */
function filesAt(commit) {
	const files = new Map();
	for (const line of git("ls-tree", "-r", commit, "--", ...PATHS).split("\n")) {
		const [meta, file] = line.split("\t");
		if (file && !TEST.test(file)) files.set(file, meta.split(" ")[2]);
	}
	return files;
}

const hashOf = (files) =>
	createHash("sha256")
		.update([...files].map(([file, blob]) => `${file}\0${blob}\n`).join(""))
		.digest("hex");

/** The record as a commit has it. */
function recordAt(commit) {
	const text = attempt(() => git("show", `${commit}:${RECORD}`));
	return text === undefined ? undefined : JSON.parse(text);
}

/** The commit the record was last written in, when its admin UI is still the one on record (a hand edit or a shallow clone has none). */
function reviewedCommit(commit, record) {
	const base = attempt(() => git("log", "-1", "--format=%H", commit, "--", RECORD).trim());
	if (!base || !record || hashOf(filesAt(base)) !== record.tree) return undefined;
	return base;
}

function changedSince(base, files) {
	const before = filesAt(base);
	const names = new Set([...before.keys(), ...files.keys()]);
	return [...names].filter((name) => before.get(name) !== files.get(name)).sort();
}

/** What is wrong with a commit, or undefined when its admin UI is the one on record. */
function problemOf(commit) {
	const files = filesAt(commit);
	const record = recordAt(commit);
	if (record?.tree === hashOf(files)) return undefined;
	const base = reviewedCommit(commit, record);
	const lines = [`The admin UI at ${short(commit)} has not been through a design review.`];
	if (base) {
		const changed = changedSince(base, files);
		lines.push(`${changed.length} file(s) changed since the review on record (${short(base)}):`);
		for (const name of changed.slice(0, 12)) lines.push(`  ${name}`);
		if (changed.length > 12) lines.push(`  … and ${changed.length - 12} more`);
		lines.push(
			`Run the design-review agent on ${short(base)}..${short(commit)}. Its last step writes the record; commit it.`,
		);
	} else {
		lines.push(
			record
				? "The record does not match the commit it was written in, so the range is not known: review the whole pull request."
				: `There is no ${RECORD} yet: the first review writes it.`,
			"Run the design-review agent. Its last step writes the record; commit it.",
		);
	}
	return lines.join("\n");
}

function check(commit) {
	const problem = problemOf(commit);
	if (problem) {
		console.error(problem);
		process.exit(1);
	}
	console.log(`check-review: the admin UI at ${short(commit)} is the one the design review read.`);
}

function record() {
	const dirty = git("status", "--porcelain", "--", ...PATHS).trim();
	if (dirty) {
		console.error(`Commit these first: the review reads commits, and the record is of HEAD.\n${dirty}`);
		process.exit(1);
	}
	const before = recordAt("HEAD");
	const base = reviewedCommit("HEAD", before);
	const files = filesAt("HEAD");
	const next = { tree: hashOf(files), head: short("HEAD"), date: new Date().toISOString().slice(0, 10) };
	writeFileSync(path.join(root, RECORD), `${JSON.stringify(next, null, "\t")}\n`);
	const since = base ? `${changedSince(base, files).length} file(s) since ${short(base)}` : "the whole tree";
	console.log(`check-review: recorded the admin UI at ${next.head} as read (${since}). Commit ${RECORD}.`);
}

/** `gh pr merge` where a command starts, not where a commit message or a search only mentions it. */
const MERGE = /(?:^|&&|\|\||[;|\n(])\s*gh\s+pr\s+merge\b([^;&|\n]*)/;

/** The pull request a `gh pr merge` command names: a number, a URL, or none (the branch's own). */
function pullOf(command) {
	const rest = command.match(MERGE)?.[1] ?? "";
	return rest.match(/\/pull\/(\d+)/)?.[1] ?? rest.match(/\s(\d+)(\s|$)/)?.[1];
}

function hook() {
	const call = JSON.parse(readFileSync(0, "utf8"));
	const command = call.tool_input?.command;
	if (call.tool_name !== "Bash" || typeof command !== "string" || !MERGE.test(command)) return;
	const refuse = (why) => {
		// Exit code 2 refuses the tool call, and Claude is shown this text.
		console.error(`Merge refused by scripts/check-review.mjs.\n${why}`);
		process.exit(2);
	};
	// Anything that goes wrong from here refuses too: a merge that could not be checked is not a checked merge.
	try {
		const pull = pullOf(command);
		const head = execFileSync(
			"gh",
			["pr", "view", ...(pull ? [pull] : []), "--json", "headRefOid", "-q", ".headRefOid"],
			{
				cwd: root,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			},
		).trim();
		if (attempt(() => git("cat-file", "-e", `${head}^{commit}`)) === undefined) git("fetch", "-q", "origin", head);
		const problem = problemOf(head);
		if (problem) refuse(problem);
	} catch (error) {
		refuse(`The pull request's design review could not be checked: ${error instanceof Error ? error.message : error}`);
	}
}

const [mode] = process.argv.slice(2);
if (mode === "--record") record();
else if (mode === "--hook") hook();
else check(mode ?? "HEAD");
