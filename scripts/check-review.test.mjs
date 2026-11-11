import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const made = [];
after(() => {
	for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

/** A repository of its own with the gate's scripts in it and one admin UI file committed. */
function repository() {
	const dir = mkdtempSync(path.join(tmpdir(), "check-review-"));
	made.push(dir);
	const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
	git("init", "-q", "-b", "main");
	for (const [key, value] of [
		["user.email", "test@example.com"],
		["user.name", "Test"],
		["commit.gpgsign", "false"],
		["core.hooksPath", "/dev/null"],
	])
		git("config", key, value);
	const write = (file, text) => {
		mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		writeFileSync(path.join(dir, file), text);
	};
	const commit = (message) => {
		git("add", "-A");
		git("commit", "-q", "-m", message);
		return git("rev-parse", "--short", "HEAD");
	};
	const run = (args = [], input = "") =>
		spawnSync("node", ["scripts/check-review.mjs", ...args], { cwd: dir, encoding: "utf8", input });
	mkdirSync(path.join(dir, "scripts"));
	for (const script of ["check-review.mjs", "merge-commands.mjs"])
		cpSync(path.join(here, script), path.join(dir, "scripts", script));
	write("packages/ui/src/button.tsx", "export const a = 1;\n");
	write("README.md", "hello\n");
	commit("start");
	/** The review's last step, and its commit. */
	const review = () => {
		assert.equal(run(["--record"]).status, 0);
		return commit("record");
	};
	return { dir, git, write, commit, run, review };
}

/** A piece of work on its own branch, off `main`: the check is given `main` as the shared branch. */
function work() {
	const made = repository();
	made.git("checkout", "-q", "-b", "work");
	return { ...made, check: (commit = "HEAD") => made.run([commit, "--base", "main"]) };
}

test("work that changes the admin UI and brings no record fails and names the files; the review's record makes it pass", () => {
	const { check, review, write, commit } = work();
	write("packages/admin/src/screens/list.tsx", "export const list = 1;\n");
	const head = commit("a screen");
	const failed = check();
	assert.equal(failed.status, 1);
	assert.match(
		failed.stderr,
		new RegExp(`The admin UI at ${head} has not been through a design review: 1 file\\(s\\) changed`),
	);
	assert.match(failed.stderr, /packages\/admin\/src\/screens\/list\.tsx/);
	assert.match(failed.stderr, /once on this work/);
	review();
	assert.equal(check().status, 0);
});

test("one review is enough: what changes after it passes, and so does work that never touched the admin UI", () => {
	const { check, review, write, commit, git } = work();
	write("packages/ui/src/one.tsx", "1\n");
	commit("one");
	review();
	write("packages/ui/src/one.tsx", "1 fixed\n");
	write("packages/ui/src/two.tsx", "2\n");
	commit("what the reviews found");
	assert.equal(check().status, 0);

	git("checkout", "-q", "-b", "other", "main");
	write("README.md", "changed\n");
	write("packages/core/src/a.ts", "export {};\n");
	write("packages/ui/src/button.test.tsx", "test\n");
	write("packages/admin/src/__test__/site.ts", "helper\n");
	commit("not the admin UI");
	assert.equal(check().status, 0);
});

test("a deleted file and a renamed one are changes", () => {
	for (const change of [
		(git) => git("rm", "-q", "packages/ui/src/button.tsx"),
		(git) => git("mv", "packages/ui/src/button.tsx", "packages/ui/src/press.tsx"),
	]) {
		const { check, commit, git } = work();
		change(git);
		commit("change");
		assert.equal(check().status, 1);
	}
});

test("the record must be of this work: one that names a commit from elsewhere, or a tree no commit of the work has, is refused", () => {
	const { check, review, write, commit, git, dir } = work();
	// The shared branch has a record of its own, from an earlier piece of work.
	git("checkout", "-q", "main");
	review();
	git("checkout", "-q", "-b", "mine");
	write("packages/ui/src/one.tsx", "1\n");
	commit("one");
	assert.equal(check().status, 1);
	// A record edited by hand: it changed, but it still names the shared branch's commit.
	const record = JSON.parse(readFileSync(path.join(dir, "scripts/design-review.json"), "utf8"));
	write("scripts/design-review.json", `${JSON.stringify({ ...record, date: "2000-01-01" })}\n`);
	commit("a record that was not written by reading this work");
	const failed = check();
	assert.equal(failed.status, 1);
	assert.match(failed.stderr, /is not of a commit of this work/);
	// Naming a commit of the work with a tree it does not have is no better.
	write(
		"scripts/design-review.json",
		`${JSON.stringify({ ...record, head: git("rev-parse", "--short", "HEAD~1") })}\n`,
	);
	commit("a made-up record");
	assert.match(check().stderr, /is not of a commit of this work/);
	review();
	assert.equal(check().status, 0);
});

test("on the shared branch a commit is its own work: the squash that brings a record passes, a commit that changes the admin UI without one fails", () => {
	const { run, review, write, commit, git } = work();
	write("packages/ui/src/one.tsx", "1\n");
	commit("one");
	review();
	write("packages/ui/src/one.tsx", "1 fixed\n");
	commit("fix after the review");
	git("checkout", "-q", "main");
	git("merge", "-q", "--squash", "work");
	commit("squash");
	// No shared branch is named here: the commit is measured against its parent.
	assert.equal(run().status, 0);
	write("README.md", "changed\n");
	commit("docs");
	assert.equal(run().status, 0);
	write("packages/ui/src/next.tsx", "next\n");
	commit("pushed straight to the shared branch");
	const failed = run();
	assert.equal(failed.status, 1);
	assert.match(failed.stderr, /next\.tsx/);
});

test("the record is of commits: it is not written over uncommitted admin UI", () => {
	const { run, review, write } = repository();
	review();
	write("packages/ui/src/button.tsx", "export const a = 2;\n");
	const refused = run(["--record"]);
	assert.equal(refused.status, 1);
	assert.match(refused.stderr, /Commit these first/);
});

test("a record that cannot be read says so, without a stack", () => {
	const { run, review, write, commit } = repository();
	review();
	write("scripts/design-review.json", '<<<<<<< HEAD\n{ "tree": "a" }\n=======\n{ "tree": "b" }\n>>>>>>> work\n');
	commit("conflict left in");
	const failed = run();
	assert.equal(failed.status, 1);
	assert.match(failed.stderr, /is not a record/);
	assert.doesNotMatch(failed.stderr, /SyntaxError|at JSON\.parse/);
});

test("a path that is not ASCII is hashed the same whatever git is set to quote", () => {
	const { run, write, commit, git, dir } = repository();
	write("packages/ui/src/한글 부품.tsx", "export const part = 1;\n");
	commit("a name in Korean");
	const recorded = () => {
		assert.equal(run(["--record"]).status, 0);
		return JSON.parse(readFileSync(path.join(dir, "scripts/design-review.json"), "utf8")).tree;
	};
	git("config", "core.quotePath", "false");
	const plain = recorded();
	git("config", "core.quotePath", "true");
	assert.equal(recorded(), plain);
});

test("the hook lets other calls through, and refuses what it cannot bind or read before it asks GitHub", () => {
	const { run } = repository();
	const bash = (command) => JSON.stringify({ tool_name: "Bash", tool_input: { command } });
	const merge = ["gh", "pr", "merge"].join(" ");
	assert.equal(run(["--hook"], bash("ls -la")).status, 0);
	assert.equal(run(["--hook"], bash(`git commit -m "what ${merge} checks"`)).status, 0);
	assert.equal(run(["--hook"], JSON.stringify({ tool_name: "Write", tool_input: { content: merge } })).status, 0);
	assert.equal(run(["--hook"], "not JSON").status, 0);
	for (const [input, says] of [
		[bash(`${merge} --squash`), /by its number or its address/],
		[bash(`${merge} some/branch --squash`), /by its number or its address/],
		[bash(`for p in 1 2; do ${merge} $p; done`), /by its number or its address/],
		[bash("gh api repos/o/r/pulls/5/merge -X PUT"), /cannot be bound/],
		[`not JSON, but ${merge} 5`, /could not read this call/],
	]) {
		const refused = run(["--hook"], input);
		assert.equal(refused.status, 2, input);
		assert.match(refused.stderr, says);
	}
});
