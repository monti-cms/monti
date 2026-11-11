import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

test("with no record the check fails and says so; the review's record makes it pass", () => {
	const { run, review } = repository();
	const first = run();
	assert.equal(first.status, 1);
	assert.match(first.stderr, /There is no scripts\/design-review\.json yet/);
	review();
	assert.equal(run().status, 0);
});

test("a change to the admin UI fails it and names the range and the file; other changes do not", () => {
	const { run, review, write, commit, git } = repository();
	const reviewed = review();
	write("README.md", "changed\n");
	write("packages/core/src/a.ts", "export {};\n");
	write("packages/ui/src/button.test.tsx", "test\n");
	write("packages/admin/src/__test__/site.ts", "helper\n");
	commit("not the admin UI");
	assert.equal(run().status, 0);

	write("packages/admin/src/screens/list.tsx", "export const list = 1;\n");
	const head = commit("a screen");
	const failed = run();
	assert.equal(failed.status, 1);
	assert.match(failed.stderr, new RegExp(`1 file\\(s\\) changed since the review on record \\(${reviewed}\\)`));
	assert.match(failed.stderr, /packages\/admin\/src\/screens\/list\.tsx/);
	assert.match(failed.stderr, new RegExp(`on ${reviewed}\\.\\.${head}`));

	// An earlier commit is checked by its own record.
	assert.equal(run([git("rev-parse", "HEAD~1")]).status, 0);
});

test("a deleted file and a renamed one are changes", () => {
	for (const change of [
		(git) => git("rm", "-q", "packages/ui/src/button.tsx"),
		(git) => git("mv", "packages/ui/src/button.tsx", "packages/ui/src/press.tsx"),
	]) {
		const { run, review, commit, git, write } = repository();
		write("packages/ui/src/keep.tsx", "export const keep = 1;\n");
		commit("another");
		review();
		change(git);
		commit("change");
		assert.equal(run().status, 1);
	}
});

test("after a second review the range starts at the second record", () => {
	const { run, review, write, commit } = repository();
	review();
	write("packages/ui/src/one.tsx", "1\n");
	commit("one");
	const second = review();
	assert.equal(run().status, 0);
	write("packages/ui/src/two.tsx", "2\n");
	commit("two");
	const failed = run();
	assert.match(failed.stderr, new RegExp(`since the review on record \\(${second}\\)`));
	assert.match(failed.stderr, /two\.tsx/);
	assert.doesNotMatch(failed.stderr, /one\.tsx/);
});

test("a squash merge carries the record: the shared branch passes, and its next range starts at the squash", () => {
	const { run, review, write, commit, git } = repository();
	review();
	git("checkout", "-q", "-b", "work");
	write("packages/ui/src/one.tsx", "1\n");
	commit("one");
	review();
	write("packages/ui/src/one.tsx", "1 fixed\n");
	commit("fix");
	review();
	git("checkout", "-q", "main");
	git("merge", "-q", "--squash", "work");
	const squash = commit("squash");
	assert.equal(run().status, 0);
	write("packages/ui/src/next.tsx", "next\n");
	commit("next");
	assert.match(run().stderr, new RegExp(`since the review on record \\(${squash}\\)`));
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
	const { run, review, write, commit, git } = repository();
	write("packages/ui/src/한글 부품.tsx", "export const part = 1;\n");
	commit("a name in Korean");
	git("config", "core.quotePath", "false");
	review();
	git("config", "core.quotePath", "true");
	assert.equal(run().status, 0);
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
