#!/usr/bin/env node
/**
 * Design review gate. The `design-review` agent (`.claude/agents/design-review.md`) reads every change to the admin UI before it joins a shared
 * branch (AGENTS.md). A rule that is only written down gets skipped: the trash's screens changed after their review and were merged unread
 * (#460). So the review leaves a record, `scripts/design-review.json`, and a commit whose admin UI is not the one on record fails.
 *
 *   node scripts/check-review.mjs            # fails if the admin UI at HEAD is not what the last review read; names the range to review
 *   node scripts/check-review.mjs <commit>   # the same for another commit (a pull request's head)
 *   node scripts/check-review.mjs --record   # the design-review agent's last step: records the admin UI at HEAD as read
 *   node scripts/check-review.mjs --hook     # Claude Code PreToolUse hook (.claude/settings.json): refuses a merge of an unread head, and one
 *                                            # not bound to the head it checked (`--match-head-commit`). `merge-commands.mjs` reads the command.
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
import { mergesIn } from "./merge-commands.mjs";

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
	// `-z`: each path as it is. Without it git writes a path that is not ASCII in quotes or not, by `core.quotePath`, and two machines would hash two things.
	for (const line of git("ls-tree", "-r", "-z", commit, "--", ...PATHS).split("\0")) {
		const [meta, file] = line.split("\t");
		if (file && !TEST.test(file)) files.set(file, meta.split(" ")[2]);
	}
	return files;
}

const hashOf = (files) =>
	createHash("sha256")
		.update([...files].map(([file, blob]) => `${file}\0${blob}\n`).join(""))
		.digest("hex");

/** The record as a commit has it: `undefined` when there is none, `UNREADABLE` when the file is not a record (a merge conflict left in it). */
const UNREADABLE = Symbol("unreadable");
function recordAt(commit) {
	const text = attempt(() => git("show", `${commit}:${RECORD}`));
	if (text === undefined) return undefined;
	const record = attempt(() => JSON.parse(text));
	return typeof record?.tree === "string" ? record : UNREADABLE;
}

/** The commit the record was last written in, when its admin UI is still the one on record (a hand edit or a shallow clone has none). */
function reviewedCommit(commit, record) {
	const base = attempt(() => git("log", "-1", "--format=%H", commit, "--", RECORD).trim());
	if (!base || !record || record === UNREADABLE || hashOf(filesAt(base)) !== record.tree) return undefined;
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
	if (record === UNREADABLE)
		return `${RECORD} at ${short(commit)} is not a record (a merge conflict left in it?). Put back the one of the branch this was made from, then run the design-review agent: its last step writes the record.`;
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

/** `owner/name` of a GitHub address, in small letters: a pull request's page, or a remote. */
const repoOf = (address) => /github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?(?:\/|$)/.exec(address)?.[1].toLowerCase();

/** Exit code 2 refuses the tool call, and Claude is shown this text. */
function refuse(why) {
	console.error(`Merge refused by scripts/check-review.mjs.\n${why}`);
	process.exit(2);
}

/**
 * The hook: every merge the command line would run is of a head the design review has read, and is bound to that head, so that what was checked is what is
 * merged. Anything that goes wrong on the way refuses too: a merge that could not be checked is not a checked merge.
 */
function hook() {
	const raw = readFileSync(0, "utf8");
	const call = attempt(() => JSON.parse(raw));
	if (call === undefined || call === null) {
		// Not a call this hook can read: it goes through unless it speaks of a merge.
		if (/gh\s+pr\s+merge|pulls\/\d+\/merge/.test(raw))
			refuse("The hook could not read this call, and it names a merge.");
		return;
	}
	const command = call.tool_input?.command;
	if (call.tool_name !== "Bash" || typeof command !== "string") return;
	try {
		for (const merge of mergesIn(command)) {
			const bound = "Merge with `gh pr merge <number> --squash --match-head-commit <sha>`.";
			if (merge.how === "api")
				refuse(`A merge through \`gh api\` cannot be bound to the commit that was checked. ${bound}`);
			// A branch's name, or none, means another pull request in another folder: only a number or an address names one.
			if (!/^\d+$/.test(merge.pull ?? "") && !/\/pull\/\d+/.test(merge.pull ?? ""))
				refuse(`Name the pull request by its number or its address. ${bound}`);
			const view = JSON.parse(
				execFileSync(
					"gh",
					["pr", "view", merge.pull, ...(merge.repo ? ["--repo", merge.repo] : []), "--json", "headRefOid,url"],
					{ cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
				),
			);
			// Another repository's pull request is not this gate's to check.
			const own = repoOf(attempt(() => git("remote", "get-url", "origin").trim()) ?? "");
			if (own && repoOf(view.url) !== own) continue;
			const head = view.headRefOid;
			if (attempt(() => git("cat-file", "-e", `${head}^{commit}`)) === undefined) git("fetch", "-q", "origin", head);
			const problem = problemOf(head);
			if (problem) refuse(problem);
			// The head can move between this check and the merge: GitHub refuses the merge when it has.
			if (merge.head !== head)
				refuse(
					`The design review has read ${short(head)}. Bind the merge to it, so that what was checked is what is merged:\n  --match-head-commit ${head}`,
				);
		}
	} catch (error) {
		refuse(`The pull request's design review could not be checked: ${error instanceof Error ? error.message : error}`);
	}
}

const [mode] = process.argv.slice(2);
if (mode === "--record") record();
else if (mode === "--hook") hook();
else check(mode ?? "HEAD");
