#!/usr/bin/env node
/**
 * Design review gate. The `design-review` agent (`.claude/agents/design-review.md`) reads a piece of admin UI work before it joins a shared branch
 * (AGENTS.md). A rule that is only written down gets skipped: the trash's screens were merged unread (#460). So the review leaves a record,
 * `scripts/design-review.json`, and work that changes the admin UI without bringing one fails.
 *
 *   node scripts/check-review.mjs [commit] [--base <ref>]   # fails if the commit's work changed the admin UI and brings no review of its own
 *   node scripts/check-review.mjs --record                  # the design-review agent's last step: records the admin UI at HEAD as read
 *   node scripts/check-review.mjs --hook                    # Claude Code PreToolUse hook (.claude/settings.json): refuses a merge of unreviewed work, and
 *                                                           # one not bound to the head it checked (`--match-head-commit`). `merge-commands.mjs` reads the command.
 *
 * The admin UI is the files of `PATHS` without their tests (stories count: they are the states the review looks at). A commit's work is what it has since
 * it left the shared branch; on the shared branch it is the one commit (a squash merge). The record holds the hash of the admin UI the review read and the
 * commit it read it at.
 *
 * One review for a piece of work (2026-11-11, owner). It ran after every change before: what the later runs found was wording and rare cases, and each fix
 * asked for another run. So what changes after the review is not read again. Run it last, after the code review and the owner's look.
 *
 * It checks that a review ran on this work's code, not what the review saw or that it was the last thing done. Nothing here stops a record written without a
 * review; the agent's last step is the only place that writes one.
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

/** The shared branches work leaves from and is merged into, nearest first. `--base <ref>` or `REVIEW_BASE` names another. */
const BASES = ["origin/overhaul", "origin/main"];
const exists = (ref) => attempt(() => git("rev-parse", "-q", "--verify", `${ref}^{commit}`).trim());
const baseOf = (given) => given ?? process.env.REVIEW_BASE ?? BASES.find(exists);

/**
 * Where a commit's own work starts: where it left the shared branch (a pull request's head), or its parent when it is on the shared branch itself (the squash
 * a pull request was merged as, `merged`). No start for a first commit.
 */
function startOf(commit, base) {
	const parent = exists(`${commit}^`);
	const fork = base && attempt(() => git("merge-base", commit, base).trim());
	if (!fork || fork === exists(commit)) return { start: parent, merged: true };
	return { start: fork, merged: false };
}

function changedSince(base, files) {
	const before = filesAt(base);
	const names = new Set([...before.keys(), ...files.keys()]);
	return [...names].filter((name) => before.get(name) !== files.get(name)).sort();
}

/**
 * What is wrong with a commit, or undefined. A piece of work that changes the admin UI is reviewed once: it must bring a record the design review wrote
 * while reading one of its own commits. What is fixed after that review is not read again; the code reviews and the owner's look are for that.
 */
function problemOf(commit, base) {
	const files = filesAt(commit);
	const record = recordAt(commit);
	if (record === UNREADABLE)
		return `${RECORD} at ${short(commit)} is not a record (a merge conflict left in it?). Put back the one of the branch this was made from, then run the design-review agent: its last step writes the record.`;
	const { start, merged } = startOf(commit, baseOf(base));
	const changed = start ? changedSince(start, files) : [...files.keys()].sort();
	if (changed.length === 0 || record?.tree === hashOf(files)) return undefined;
	const before = start ? recordAt(start) : undefined;
	if (record !== undefined && JSON.stringify(record) !== JSON.stringify(before)) {
		// On the shared branch the commit that was read is gone with its branch: the squash that brought a new record is taken at its word.
		if (merged) return undefined;
		const read = exists(record.head);
		const isAncestor = (older, newer) => attempt(() => git("merge-base", "--is-ancestor", older, newer)) !== undefined;
		if (
			read &&
			read !== start &&
			isAncestor(start, read) &&
			isAncestor(read, commit) &&
			hashOf(filesAt(read)) === record.tree
		)
			return undefined;
		return `${RECORD} at ${short(commit)} is not of a commit of this work (it names ${record.head}). Run the design-review agent: its last step writes the record; commit it.`;
	}
	const lines = [
		`The admin UI at ${short(commit)} has not been through a design review: ${changed.length} file(s) changed${start ? ` since ${short(start)}` : ""} and the work brings no record.`,
	];
	for (const name of changed.slice(0, 12)) lines.push(`  ${name}`);
	if (changed.length > 12) lines.push(`  … and ${changed.length - 12} more`);
	lines.push(
		"Run the design-review agent once on this work, after the code review and the owner's look. Its last step writes the record; commit it.",
		"What changes after that review does not need another.",
	);
	return lines.join("\n");
}

function check(commit, base) {
	const problem = problemOf(commit, base);
	if (problem) {
		console.error(problem);
		process.exit(1);
	}
	console.log(`check-review: the admin UI at ${short(commit)} has had its design review.`);
}

function record() {
	const dirty = git("status", "--porcelain", "--", ...PATHS).trim();
	if (dirty) {
		console.error(`Commit these first: the review reads commits, and the record is of HEAD.\n${dirty}`);
		process.exit(1);
	}
	const next = { tree: hashOf(filesAt("HEAD")), head: short("HEAD"), date: new Date().toISOString().slice(0, 10) };
	writeFileSync(path.join(root, RECORD), `${JSON.stringify(next, null, "\t")}\n`);
	console.log(`check-review: recorded the admin UI at ${next.head} as read. Commit ${RECORD}.`);
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
					[
						"pr",
						"view",
						merge.pull,
						...(merge.repo ? ["--repo", merge.repo] : []),
						"--json",
						"headRefOid,url,baseRefName",
					],
					{ cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
				),
			);
			// Another repository's pull request is not this gate's to check.
			const own = repoOf(attempt(() => git("remote", "get-url", "origin").trim()) ?? "");
			if (own && repoOf(view.url) !== own) continue;
			const head = view.headRefOid;
			if (attempt(() => git("cat-file", "-e", `${head}^{commit}`)) === undefined) git("fetch", "-q", "origin", head);
			// The branch it is merged into, as it is now: the pull request's own work is what it has since it left that branch.
			git("fetch", "-q", "origin", view.baseRefName);
			const problem = problemOf(head, `origin/${view.baseRefName}`);
			if (problem) refuse(problem);
			// The head can move between this check and the merge: GitHub refuses the merge when it has.
			if (merge.head !== head)
				refuse(
					`${short(head)} has had its design review. Bind the merge to it, so that what was checked is what is merged:\n  --match-head-commit ${head}`,
				);
		}
	} catch (error) {
		refuse(`The pull request's design review could not be checked: ${error instanceof Error ? error.message : error}`);
	}
}

const args = process.argv.slice(2);
const baseAt = args.indexOf("--base");
const base = baseAt === -1 ? undefined : args.splice(baseAt, 2)[1];
const [mode] = args;
if (mode === "--record") record();
else if (mode === "--hook") hook();
else check(mode ?? "HEAD", base);
