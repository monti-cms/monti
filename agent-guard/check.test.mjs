import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const GUARD = path.dirname(fileURLToPath(import.meta.url));
const CHECK = path.join(GUARD, "check.mjs");
const TYPESCRIPT = path.dirname(createRequire(import.meta.url).resolve("typescript/package.json"));
const WORKER = "thread:delegated-task:test";
const FIX_AND_RETRY = "Fix these and try to finish again.";
const ESCALATION_START = "The check failed 3 times in a row. Stop fixing.";

const roots = [];
after(() => {
	for (const root of roots) rmSync(root, { recursive: true, force: true });
});

// A stand-in for pnpm that counts its runs and fails, hangs or passes as the test says.
const FAKE_PNPM = `#!/bin/sh
echo run >> "$GUARD_STATE/runs"
echo "$PATH" > "$GUARD_STATE/path"
if [ -f "$GUARD_STATE/hang" ]; then sleep 30; fi
if [ -f "$GUARD_STATE/fail" ]; then cat "$GUARD_STATE/fail"; exit 1; fi
echo lint passed
`;

const INITIAL_FILES = {
	"docs/acceptance/core/a.md": "condition\n",
	"docs/notes.md": "notes\n",
	"agent-guard/other.mjs": "export {};\n",
	".husky/pre-commit": "pnpm lint-staged\n",
	".claude/settings.json": "{}\n",
	".codex/hooks.json": "{}\n",
	"packages/core/biome.json": "{}\n",
	"packages/core/.dependency-cruiser.cjs": "module.exports = {};\n",
	"packages/core/biome-plugins/p.grit": "grit\n",
	"packages/core/src/a.ts": "export const a = 1;\n",
	"package.json": "{}\n",
};

// A condition that has no test, and the test that answers it; `fixture({ ...CONDITION })` starts with the condition committed.
const CONDITION = { "docs/acceptance/core/db.md": "DB-1  A thing\n  결과  DB-1.1  it happens\n" };
const FENCE_TEST = `import { expect, it } from "vitest";

it("DB-1 does the thing", () => {
	// DB-1.1
	expect(1).toBe(1);
});
`;
const UNMARKED_TEST = FENCE_TEST.replace("\t// DB-1.1\n", "");
const FENCE_FAILED = /The acceptance fence failed:\n- docs\/acceptance\/core\/db\.md:1: DB-1 has no test/;

/** A git repository with one commit, a fake pnpm on PATH and a private tmpdir for the hook's state files. */
function fixture(extraFiles = {}) {
	const base = realpathSync(mkdtempSync(path.join(tmpdir(), "monti-check-test-")));
	roots.push(base);
	const repo = path.join(base, "repo");
	const bin = path.join(base, "bin");
	const state = path.join(base, "state");
	const tmp = path.join(base, "tmp");
	for (const dir of [repo, bin, state, tmp]) mkdirSync(dir);
	writeFileSync(path.join(bin, "pnpm"), FAKE_PNPM);
	chmodSync(path.join(bin, "pnpm"), 0o755);

	const f = { repo, state, bin, tmp };
	f.git = (...args) => {
		const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
		assert.equal(result.status, 0, result.stderr);
		return result.stdout;
	};
	f.write = (file, content) => {
		mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
		writeFileSync(path.join(repo, file), content);
	};
	f.read = (file) => readFileSync(path.join(repo, file), "utf8");
	f.lintRuns = () => {
		const file = path.join(state, "runs");
		return existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").length : 0;
	};
	f.lintFails = (output = "lint error") => writeFileSync(path.join(state, "fail"), `${output}\n`);
	f.lintPasses = () => rmSync(path.join(state, "fail"), { force: true });
	f.lintHangs = () => writeFileSync(path.join(state, "hang"), "");

	f.run = (args, { input = "", env = {}, thread = WORKER, cwd = repo, check = CHECK } = {}) => {
		const childEnv = {
			...process.env,
			PATH: `${bin}${path.delimiter}${process.env.PATH}`,
			TMPDIR: tmp,
			TMP: tmp,
			TEMP: tmp,
			GUARD_STATE: state,
			...env,
		};
		delete childEnv.T3CODE_THREAD_ID;
		if (thread) childEnv.T3CODE_THREAD_ID = thread;
		return spawnSync(process.execPath, [check, ...args], { cwd, input, env: childEnv, encoding: "utf8" });
	};
	f.lintPath = () => readFileSync(path.join(state, "path"), "utf8").trim();

	/**
	 * What T3 Code creates for a worker: a linked worktree with the committed files but no `node_modules`. The main checkout
	 * has TypeScript and a `.bin` folder; the guard's own files are committed in it, so the worktree runs its own copies.
	 */
	f.worktree = () => {
		for (const file of ["check.mjs", "fence.mjs"]) f.write(`agent-guard/${file}`, readFileSync(path.join(GUARD, file)));
		f.git("add", "-A");
		f.git("commit", "-q", "-m", "guard");
		mkdirSync(path.join(repo, "node_modules", ".bin"), { recursive: true });
		symlinkSync(TYPESCRIPT, path.join(repo, "node_modules", "typescript"), "dir");
		const dir = path.join(base, "worktree");
		f.git("worktree", "add", "-q", "-b", "fresh", dir);
		const run = (args, options = {}) =>
			f.run(args, { ...options, cwd: dir, check: path.join(dir, "agent-guard", "check.mjs") });
		return {
			dir,
			stop: (payload = { session_id: "s1" }, options) =>
				run(["--stop"], { ...options, input: JSON.stringify(payload) }),
			write: (file, content) => {
				mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
				writeFileSync(path.join(dir, file), content);
			},
		};
	};

	f.stop = (payload = { session_id: "s1" }, options = {}) =>
		f.run(["--stop"], { ...options, input: typeof payload === "string" ? payload : JSON.stringify(payload) });

	f.git("init", "-q", "-b", "main");
	f.git("config", "user.email", "test@example.com");
	f.git("config", "user.name", "Test");
	f.git("config", "commit.gpgsign", "false");
	for (const [file, content] of Object.entries({ ...INITIAL_FILES, ...extraFiles })) f.write(file, content);
	f.git("add", "-A");
	f.git("commit", "-q", "-m", "initial");
	return f;
}

const allowed = (result) => {
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stderr, "");
};

describe("who is checked", () => {
	test("a session that is not a worker is allowed with protected files and failing code", () => {
		const f = fixture();
		f.write("docs/acceptance/core/a.md", "changed\n");
		f.write("packages/core/src/a.ts", "broken\n");
		f.lintFails();
		allowed(f.stop(undefined, { thread: "thread:pm" }));
		allowed(f.stop(undefined, { thread: "" }));
		assert.equal(f.lintRuns(), 0);
	});

	test("a sub-agent (agent_id in the payload) is a worker even without a delegated thread", () => {
		const f = fixture();
		f.write("docs/acceptance/core/a.md", "changed\n");
		const result = f.stop({ session_id: "s1", agent_id: "agent-7" }, { thread: "" });
		assert.equal(result.status, 2);
		assert.match(result.stderr, /docs\/acceptance\/core\/a\.md/);
		allowed(f.stop({ session_id: "s2", agent_id: "" }, { thread: "" }));
	});
});

describe("protected files", () => {
	const cases = [
		["a tracked acceptance condition", () => ["docs/acceptance/core/a.md", "changed\n"]],
		["a new acceptance condition", () => ["docs/acceptance/core/new.md", "new\n"]],
		["the guard itself", () => ["agent-guard/check.mjs", "export {};\n"]],
		["a git hook", () => [".husky/pre-commit", "true\n"]],
		["a new git hook", () => [".husky/pre-push", "true\n"]],
		["the Claude Code hook config", () => [".claude/settings.json", '{"hooks":{}}\n']],
		["the Codex hook config", () => [".codex/hooks.json", '{"hooks":{}}\n']],
		["the Antigravity hook config", () => [".agents/hooks.json", "{}\n"]],
		["the Gemini hook config", () => [".gemini/settings.json", "{}\n"]],
		["the core lint config", () => ["packages/core/biome.json", '{"x":1}\n']],
		["the dependency rules", () => ["packages/core/.dependency-cruiser.cjs", "module.exports = { x: 1 };\n"]],
		["a lint plugin", () => ["packages/core/biome-plugins/p.grit", "changed\n"]],
		["a new lint plugin", () => ["packages/core/biome-plugins/q.grit", "new\n"]],
		["a shared root lint plugin", () => ["biome-plugins/p.grit", "new\n"]],
		["a cli lint config", () => ["packages/cli/biome.json", '{"x":1}\n']],
		["a core integration test", () => ["packages/core/tests/integration.test.ts", "test();\n"]],
	];

	for (const [title, change] of cases) {
		test(`blocks ${title}, names it and leaves it as the worker wrote it`, () => {
			const f = fixture();
			const [file, content] = change();
			f.write(file, content);
			const result = f.stop();
			assert.equal(result.status, 2);
			assert.match(result.stderr, new RegExp(`- ${file.replaceAll(".", "\\.")}\\n`));
			assert.match(result.stderr, /git checkout HEAD --/);
			assert.match(result.stderr, /report it to the PM/);
			assert.ok(result.stderr.includes(FIX_AND_RETRY));
			assert.equal(f.read(file), content);
			assert.equal(f.lintRuns(), 0);
		});
	}

	test("blocks a protected file that is staged, deleted or moved out", () => {
		const f = fixture();
		f.git("mv", "docs/acceptance/core/a.md", "packages/core/src/moved.md");
		f.git("rm", "-q", "agent-guard/other.mjs");
		const result = f.stop();
		assert.equal(result.status, 2);
		assert.match(result.stderr, /- docs\/acceptance\/core\/a\.md\n/);
		assert.match(result.stderr, /- agent-guard\/other\.mjs\n/);
	});

	test("takes a protected file over a failing lint", () => {
		const f = fixture();
		f.write("packages/core/src/a.ts", "broken\n");
		f.write("docs/acceptance/core/a.md", "changed\n");
		f.lintFails();
		assert.match(f.stop().stderr, /Protected files were changed/);
		assert.equal(f.lintRuns(), 0);
	});

	test("counts toward the three strikes", () => {
		const f = fixture();
		f.write("docs/acceptance/core/a.md", "changed\n");
		assert.ok(f.stop().stderr.includes(FIX_AND_RETRY));
		assert.ok(f.stop().stderr.includes(FIX_AND_RETRY));
		assert.ok(f.stop().stderr.includes(ESCALATION_START));
		allowed(f.stop());
		assert.equal(f.read("docs/acceptance/core/a.md"), "changed\n");
	});
});

describe("code checks", () => {
	test("allows changes that need no lint without running it", () => {
		const f = fixture();
		allowed(f.stop());
		f.write("docs/notes.md", "changed\n");
		f.write("docs/refactor/new.md", "new\n");
		allowed(f.stop());
		assert.equal(f.lintRuns(), 0);
	});

	for (const file of [
		"packages/core/src/new.ts",
		"scripts/tool.mjs",
		"package.json",
		"pnpm-lock.yaml",
		"biome.json",
		"tsconfig.json",
		"packages/core/tsconfig.build.json",
	]) {
		test(`runs lint for a change to ${file}`, () => {
			const f = fixture();
			f.write(file, "changed\n");
			allowed(f.stop());
			assert.equal(f.lintRuns(), 1);
		});
	}

	test("blocks with the last 40 lines of a failing lint", () => {
		const f = fixture();
		f.write("packages/core/src/a.ts", "broken\n");
		f.lintFails(Array.from({ length: 60 }, (_, i) => `error line ${i + 1}`).join("\n"));
		const result = f.stop();
		assert.equal(result.status, 2);
		assert.equal(result.stdout, "");
		assert.match(result.stderr, /error line 60\n/);
		assert.match(result.stderr, /error line 21\n/);
		assert.doesNotMatch(result.stderr, /error line 20\n/);
		assert.ok(result.stderr.trimEnd().endsWith(FIX_AND_RETRY));
	});

	test("does not run lint again for a working tree that already passed, and runs it again after any change", () => {
		const f = fixture();
		f.write("packages/core/src/a.ts", "export const a = 2;\n");
		allowed(f.stop());
		allowed(f.stop());
		assert.equal(f.lintRuns(), 1);

		f.write("packages/core/src/a.ts", "export const a = 3;\n");
		allowed(f.stop());
		assert.equal(f.lintRuns(), 2);

		f.write("packages/core/src/b.ts", "export const b = 1;\n");
		allowed(f.stop());
		assert.equal(f.lintRuns(), 3);

		f.write("packages/core/src/b.ts", "export const b = 2;\n");
		allowed(f.stop());
		assert.equal(f.lintRuns(), 4);
		allowed(f.stop());
		assert.equal(f.lintRuns(), 4);
	});

	test("remembers a passing working tree per session", () => {
		const f = fixture();
		f.write("packages/core/src/a.ts", "export const a = 2;\n");
		allowed(f.stop({ session_id: "one" }));
		allowed(f.stop({ session_id: "two" }));
		assert.equal(f.lintRuns(), 2);
	});

	test("does not remember a working tree that failed", () => {
		const f = fixture();
		f.write("packages/core/src/a.ts", "broken\n");
		f.lintFails();
		assert.equal(f.stop().status, 2);
		assert.equal(f.stop().status, 2);
		assert.equal(f.lintRuns(), 2);
	});
});

describe("the acceptance fence on a stop", () => {
	test("runs together with lint, and a core change that matches the conditions passes", () => {
		const f = fixture(CONDITION);
		f.write("packages/core/src/db.test.ts", FENCE_TEST);
		allowed(f.stop());
		assert.equal(f.lintRuns(), 1);
	});

	test("blocks a core change that breaks it, names the problem and still ran lint", () => {
		const f = fixture(CONDITION);
		f.write("packages/core/src/db.test.ts", UNMARKED_TEST);
		const result = f.stop();
		assert.equal(result.status, 2);
		assert.match(
			result.stderr,
			/The acceptance fence failed:\n- packages\/core\/src\/db\.test\.ts:4: the line above this expect/,
		);
		assert.doesNotMatch(result.stderr, /pnpm lint/);
		assert.ok(result.stderr.trimEnd().endsWith(FIX_AND_RETRY));
		assert.equal(f.lintRuns(), 1);
	});

	test("blocks a change with no test for a condition, and reports lint and the fence together", () => {
		const f = fixture(CONDITION);
		f.write("packages/core/src/a.ts", "export const a = 2;\n");
		f.lintFails("lint error");
		const result = f.stop();
		assert.equal(result.status, 2);
		assert.match(result.stderr, /`pnpm lint` failed:\nlint error\n\nThe acceptance fence failed:/);
		assert.match(result.stderr, FENCE_FAILED);
	});

	test("lists 40 problems and counts the rest", () => {
		const conditions = Array.from(
			{ length: 45 },
			(_, i) => `DB-${i + 1}  A thing\n  결과  DB-${i + 1}.1  it happens\n`,
		);
		const f = fixture({ "docs/acceptance/core/db.md": conditions.join("\n") });
		f.write("packages/core/src/a.ts", "export const a = 2;\n");
		const { stderr } = f.stop();
		assert.equal(stderr.match(/^- docs\/acceptance/gm).length, 40);
		assert.match(stderr, /\.\.\.and 5 more\n/);
	});

	test("a failing fence counts toward the three strikes, and a fixed one resets them", () => {
		const f = fixture(CONDITION);
		f.write("packages/core/src/db.test.ts", UNMARKED_TEST);
		assert.ok(f.stop().stderr.includes(FIX_AND_RETRY));
		assert.ok(f.stop().stderr.includes(FIX_AND_RETRY));
		assert.ok(f.stop().stderr.includes(ESCALATION_START));
		allowed(f.stop());

		f.write("packages/core/src/db.test.ts", FENCE_TEST);
		allowed(f.stop());
		assert.equal(f.lintRuns(), 4);
	});

	test("does not read the fence for a change that needs no lint", () => {
		const f = fixture(CONDITION);
		f.write("docs/notes.md", "changed\n");
		allowed(f.stop());
		assert.equal(f.lintRuns(), 0);
	});
});

describe("three strikes", () => {
	test("escalates on the third failure in a row, lets the next stop through, then checks again", () => {
		const f = fixture();
		f.write("packages/core/src/a.ts", "broken\n");
		f.lintFails("boom");

		for (const _ of [1, 2]) {
			const result = f.stop();
			assert.equal(result.status, 2);
			assert.ok(result.stderr.includes(FIX_AND_RETRY));
			assert.ok(!result.stderr.includes(ESCALATION_START));
		}

		const third = f.stop();
		assert.equal(third.status, 2);
		assert.ok(third.stderr.includes("boom"));
		assert.ok(third.stderr.includes(ESCALATION_START));
		assert.ok(
			third.stderr.includes(
				"The check failed 3 times in a row. Stop fixing. Report the failing check and its output to the PM, word for word, and do not commit or push. If an acceptance condition looks wrong, say so in the report; do not change anything to get around the check.",
			),
		);
		assert.ok(!third.stderr.includes(FIX_AND_RETRY));
		assert.equal(f.lintRuns(), 3);

		allowed(f.stop());
		assert.equal(f.lintRuns(), 3);

		const again = f.stop();
		assert.equal(again.status, 2);
		assert.ok(again.stderr.includes(FIX_AND_RETRY));
		assert.equal(f.lintRuns(), 4);
	});

	test("a pass resets the count", () => {
		const f = fixture();
		f.write("packages/core/src/a.ts", "broken\n");
		f.lintFails();
		assert.equal(f.stop().status, 2);
		assert.equal(f.stop().status, 2);

		f.lintPasses();
		f.write("packages/core/src/a.ts", "fixed\n");
		allowed(f.stop());

		f.lintFails();
		f.write("packages/core/src/a.ts", "broken again\n");
		for (const _ of [1, 2]) {
			const result = f.stop();
			assert.equal(result.status, 2);
			assert.ok(!result.stderr.includes(ESCALATION_START));
		}
		assert.ok(f.stop().stderr.includes(ESCALATION_START));
	});

	test("a stop with nothing to check also resets the count", () => {
		const f = fixture();
		f.write("packages/core/src/a.ts", "broken\n");
		f.lintFails();
		assert.equal(f.stop().status, 2);
		assert.equal(f.stop().status, 2);
		f.git("checkout", "--", "packages/core/src/a.ts");
		allowed(f.stop());
		f.write("packages/core/src/a.ts", "broken\n");
		assert.ok(!f.stop().stderr.includes(ESCALATION_START));
	});

	test("counts each session on its own", () => {
		const f = fixture();
		f.write("packages/core/src/a.ts", "broken\n");
		f.lintFails();
		for (const _ of [1, 2]) f.stop({ session_id: "one" });
		assert.ok(f.stop({ session_id: "two" }).stderr.includes(FIX_AND_RETRY));
		assert.ok(f.stop({ session_id: "one" }).stderr.includes(ESCALATION_START));
	});
});

describe("how the answer is given", () => {
	test("Claude Code and Codex get the reason on stderr with exit code 2, and silence when allowed", () => {
		const f = fixture();
		f.write("packages/core/src/a.ts", "broken\n");
		f.lintFails();
		const blocked = f.stop();
		assert.equal(blocked.status, 2);
		assert.equal(blocked.stdout, "");
		assert.match(blocked.stderr, /pnpm lint/);

		f.lintPasses();
		const passed = f.stop();
		assert.equal(passed.status, 0);
		assert.equal(passed.stdout, "");
		assert.equal(passed.stderr, "");
	});

	test("Antigravity gets JSON on stdout with exit code 0", () => {
		const f = fixture();
		const payload = { session_id: "s1", executionNum: 1, fullyIdle: true };
		f.write("packages/core/src/a.ts", "broken\n");
		f.lintFails();

		const blocked = f.stop(payload);
		assert.equal(blocked.status, 0);
		assert.equal(blocked.stderr, "");
		const answer = JSON.parse(blocked.stdout);
		assert.equal(answer.decision, "continue");
		assert.match(answer.reason, /pnpm lint/);
		assert.ok(answer.reason.includes(FIX_AND_RETRY));

		f.lintPasses();
		f.write("packages/core/src/a.ts", "fixed\n");
		const passed = f.stop(payload);
		assert.equal(passed.status, 0);
		assert.deepEqual(JSON.parse(passed.stdout), { decision: "stop" });
	});

	test("Antigravity is only checked when it is fully idle", () => {
		const f = fixture();
		f.write("docs/acceptance/core/a.md", "changed\n");
		f.write("packages/core/src/a.ts", "broken\n");
		f.lintFails();
		for (const payload of [
			{ session_id: "s1", executionNum: 1 },
			{ session_id: "s1", executionNum: 1, fullyIdle: false },
			{ session_id: "s1", executionNum: 1, fullyIdle: "true" },
		]) {
			const result = f.stop(payload);
			assert.equal(result.status, 0);
			assert.equal(result.stdout, "");
			assert.equal(result.stderr, "");
		}
		assert.equal(f.lintRuns(), 0);
		assert.equal(
			JSON.parse(f.stop({ session_id: "s1", executionNum: 1, fullyIdle: true }).stdout).decision,
			"continue",
		);
	});

	test("Antigravity that is not a worker is left alone", () => {
		const f = fixture();
		f.write("docs/acceptance/core/a.md", "changed\n");
		const result = f.stop({ session_id: "s1", executionNum: 1, fullyIdle: true }, { thread: "" });
		assert.equal(result.status, 0);
		assert.equal(result.stdout, "");
	});

	test("Antigravity escalates and lets the next stop through", () => {
		const f = fixture();
		const payload = { session_id: "s1", executionNum: 1, fullyIdle: true };
		f.write("packages/core/src/a.ts", "broken\n");
		f.lintFails();
		f.stop(payload);
		f.stop(payload);
		assert.ok(JSON.parse(f.stop(payload).stdout).reason.includes(ESCALATION_START));
		assert.deepEqual(JSON.parse(f.stop(payload).stdout), { decision: "stop" });
	});
});

describe("failing open", () => {
	test("malformed stdin is allowed with a warning", () => {
		const f = fixture();
		f.write("docs/acceptance/core/a.md", "changed\n");
		for (const input of ["{not json", "[]", "null", "42"]) {
			const result = f.stop(input);
			assert.equal(result.status, 0);
			assert.match(result.stderr, /agent-guard: the check could not run and was skipped/);
		}
	});

	test("empty stdin is read as an empty payload", () => {
		const f = fixture();
		f.write("docs/acceptance/core/a.md", "changed\n");
		assert.equal(f.stop("").status, 2);
	});

	test("a lint that does not finish in time is allowed with a warning, kills the whole lint and counts no strike", () => {
		const f = fixture();
		f.write("packages/core/src/a.ts", "export const a = 2;\n");
		f.lintHangs();
		const started = Date.now();
		const result = f.stop(undefined, { env: { MONTI_CHECK_TIMEOUT_MS: "400" } });
		assert.ok(Date.now() - started < 10_000, "the hook must not wait for the lint's children");
		assert.equal(result.status, 0);
		assert.match(result.stderr, /pnpm lint did not finish in 0\.4s/);

		rmSync(path.join(f.state, "hang"));
		f.lintFails();
		for (const _ of [1, 2]) assert.ok(!f.stop().stderr.includes(ESCALATION_START));
		assert.ok(f.stop().stderr.includes(ESCALATION_START));
	});

	test("a repository without a commit is allowed with a warning", () => {
		const f = fixture();
		const empty = path.join(f.tmp, "empty");
		mkdirSync(empty);
		spawnSync("git", ["init", "-q"], { cwd: empty });
		const result = spawnSync(process.execPath, [CHECK, "--stop"], {
			cwd: empty,
			input: "{}",
			encoding: "utf8",
			env: { ...process.env, T3CODE_THREAD_ID: WORKER, TMPDIR: f.tmp },
		});
		assert.equal(result.status, 0);
		assert.match(result.stderr, /agent-guard: the check could not run and was skipped/);
	});

	test("an unknown option is an error", () => {
		const f = fixture();
		const result = f.run(["--nope"]);
		assert.equal(result.status, 1);
		assert.match(result.stderr, /Unknown option --nope/);
	});
});

describe("a fresh worktree without node_modules", () => {
	test("a stop finds TypeScript in the main checkout and blocks a broken test instead of skipping the check", () => {
		const worktree = fixture(CONDITION).worktree();
		assert.ok(!existsSync(path.join(worktree.dir, "node_modules")));
		worktree.write("packages/core/src/db.test.ts", UNMARKED_TEST);
		const result = worktree.stop();
		assert.equal(result.status, 2, result.stderr);
		assert.match(
			result.stderr,
			/The acceptance fence failed:\n- packages\/core\/src\/db\.test\.ts:4: the line above this expect/,
		);
		assert.doesNotMatch(result.stderr, /could not run/);
	});

	test("a stop lets a worktree with a matching test finish", () => {
		const worktree = fixture(CONDITION).worktree();
		worktree.write("packages/core/src/db.test.ts", FENCE_TEST);
		allowed(worktree.stop());
	});

	test("pnpm lint runs with the main checkout's .bin folders first on PATH", () => {
		const f = fixture(CONDITION);
		const worktree = f.worktree();
		worktree.write("packages/core/src/db.test.ts", FENCE_TEST);
		allowed(worktree.stop());
		assert.equal(f.lintRuns(), 1);
		assert.ok(f.lintPath().startsWith(`${path.join(f.repo, "node_modules", ".bin")}${path.delimiter}`), f.lintPath());
	});

	test("a worktree that has its own node_modules keeps its PATH", () => {
		const f = fixture(CONDITION);
		const worktree = f.worktree();
		mkdirSync(path.join(worktree.dir, "node_modules"));
		worktree.write("packages/core/src/db.test.ts", FENCE_TEST);
		allowed(worktree.stop());
		assert.ok(f.lintPath().startsWith(`${f.bin}${path.delimiter}`), f.lintPath());
	});
});

describe("--pre-tool", () => {
	const PM = "thread:pm";
	const edit = (f, payload, options = {}) => f.run(["--pre-tool"], { ...options, input: JSON.stringify(payload) });
	const blocked = (result, pattern) => {
		assert.equal(result.status, 2, result.stderr);
		assert.match(result.stderr, pattern);
	};

	test("allows the PM editing any file, packages/, scripts/ and the protected files among them", () => {
		const f = fixture();
		const files = [
			"packages/core/src/a.ts",
			"scripts/new.mjs",
			"packages/core/env.d.ts",
			"docs/notes.md",
			"docs/acceptance/core/a.md",
			"agent-guard/check.mjs",
			"package.json",
		];
		for (const thread of [PM, ""])
			for (const file of files)
				allowed(edit(f, { tool_name: "Edit", tool_input: { file_path: path.join(f.repo, file) } }, { thread }));
		allowed(
			edit(f, { tool_name: "Write", cwd: f.repo, tool_input: { file_path: "packages/core/env.d.ts" } }, { thread: PM }),
		);
	});

	test("blocks a worker editing a protected file, packages/core/env.d.ts among them", () => {
		const f = fixture();
		for (const file of [
			"packages/core/env.d.ts",
			"packages/core/stryker.config.mjs",
			"packages/core/vitest.config.ts",
			"docs/acceptance/core/a.md",
			"agent-guard/check.mjs",
			".secretlintrc.json",
		]) {
			const result = edit(f, { tool_name: "Write", tool_input: { file_path: path.join(f.repo, file) } });
			blocked(result, new RegExp(`a worker may not change them:\\n- ${file.replaceAll(".", "\\.")}\\n`));
		}
		blocked(
			edit(
				f,
				{ tool_name: "Edit", agent_id: "agent-7", tool_input: { file_path: path.join(f.repo, "agent-guard/x.mjs") } },
				{ thread: "" },
			),
			/- agent-guard\/x\.mjs/,
		);
	});

	test("allows a worker editing the core's code", () => {
		const f = fixture();
		allowed(edit(f, { tool_name: "Edit", tool_input: { file_path: path.join(f.repo, "packages/core/src/a.ts") } }));
		allowed(
			edit(
				f,
				{
					tool_name: "Write",
					agent_id: "agent-7",
					tool_input: { file_path: path.join(f.repo, "packages/core/src/new/b.ts") },
				},
				{ thread: "" },
			),
		);
	});

	test("reads the targets of the other editors' tools", () => {
		const f = fixture();
		const file = path.join(f.repo, "agent-guard/check.mjs");
		for (const tool_input of [{ notebook_path: file }, { TargetFile: file }, { path: file }])
			blocked(edit(f, { tool_name: "NotebookEdit", tool_input }), /- agent-guard\/check\.mjs/);
		blocked(edit(f, { tool_name: "write_to_file", tool_input: { TargetFile: file } }), /check\.mjs/);
		const patch =
			"*** Begin Patch\n*** Update File: agent-guard/check.mjs\n@@\n-a\n+b\n*** Add File: docs/x.md\n+x\n*** End Patch\n";
		for (const tool_input of [{ command: ["apply_patch", patch] }, { patch }, patch]) {
			const result = edit(f, { tool_name: "apply_patch", cwd: f.repo, tool_input });
			blocked(result, /- agent-guard\/check\.mjs\n/);
			assert.doesNotMatch(result.stderr, /docs\/x\.md/);
		}
	});

	test("places a file by its own repository, not the session's directory", () => {
		const f = fixture();
		const elsewhere = realpathSync(mkdtempSync(path.join(tmpdir(), "monti-check-elsewhere-")));
		roots.push(elsewhere);
		const result = edit(
			f,
			{ tool_name: "Edit", tool_input: { file_path: path.join(f.repo, "agent-guard/check.mjs") } },
			{ cwd: elsewhere },
		);
		blocked(result, /- agent-guard\/check\.mjs/);
		allowed(edit(f, { tool_name: "Write", tool_input: { file_path: path.join(elsewhere, "agent-guard/x.mjs") } }));
	});

	test("lets reads and other tools through, and fails open on a bad payload", () => {
		const f = fixture();
		const file = path.join(f.repo, "agent-guard/check.mjs");
		allowed(edit(f, { tool_name: "Read", tool_input: { file_path: file } }));
		allowed(edit(f, { tool_name: "Bash", tool_input: { command: "ls" } }));
		const bad = f.run(["--pre-tool"], { input: "not json" });
		assert.equal(bad.status, 0);
		assert.match(bad.stderr, /the check could not run and was skipped/);
	});

	test("Antigravity's toolCall gets a deny or allow decision as JSON on stdout with exit code 0", () => {
		const f = fixture();
		const call = (name, file, extra = {}, options = {}) =>
			edit(f, { toolCall: { name, args: { TargetFile: file } }, stepIdx: 19, conversationId: "c1", ...extra }, options);

		const denied = call("write_to_file", path.join(f.repo, "agent-guard/check.mjs"));
		assert.equal(denied.status, 0);
		assert.equal(denied.stderr, "");
		const answer = JSON.parse(denied.stdout);
		assert.equal(answer.decision, "deny");
		assert.match(answer.reason, /a worker may not change them:\n- agent-guard\/check\.mjs\n/);

		for (const result of [
			call("multi_replace_file_content", path.join(f.repo, "packages/core/src/a.ts")),
			call("replace_file_content", path.join(f.repo, "packages/core/src/a.ts"), {}, { thread: PM }),
			call("write_to_file", path.join(f.repo, "agent-guard/check.mjs"), {}, { thread: PM }),
			call("view_file", path.join(f.repo, "agent-guard/check.mjs")),
		]) {
			assert.equal(result.status, 0);
			assert.equal(result.stderr, "");
			assert.deepEqual(JSON.parse(result.stdout), { decision: "allow" });
		}
	});

	test("Antigravity's relative target is placed in its first workspace path", () => {
		const f = fixture();
		const elsewhere = realpathSync(mkdtempSync(path.join(tmpdir(), "monti-check-elsewhere-")));
		roots.push(elsewhere);
		const result = edit(
			f,
			{
				toolCall: { name: "write_to_file", args: { TargetFile: "docs/acceptance/core/a.md" } },
				workspacePaths: [f.repo],
			},
			{ cwd: elsewhere },
		);
		assert.equal(result.status, 0);
		assert.equal(JSON.parse(result.stdout).decision, "deny");
		assert.match(JSON.parse(result.stdout).reason, /- docs\/acceptance\/core\/a\.md/);
	});

	test("the PM's stop and commit of a worker's code in the shared worktree are not blocked", () => {
		const f = fixture();
		f.write("packages/core/src/ok.ts", "export const ok = 1;\n");
		f.lintFails();
		allowed(f.stop(undefined, { thread: PM }));
		f.git("add", "-A");
		allowed(f.run(["--pre-commit"], { thread: PM }));
	});
});

describe("--pre-commit", () => {
	test("blocks a worker's commit that has a protected file staged, and lists the files", () => {
		const f = fixture();
		f.write("docs/acceptance/core/a.md", "changed\n");
		f.write(".husky/pre-push", "true\n");
		f.write("packages/core/src/ok.ts", "ok\n");
		f.git("add", "-A");
		const result = f.run(["--pre-commit"]);
		assert.equal(result.status, 1);
		assert.match(result.stderr, /- docs\/acceptance\/core\/a\.md\n/);
		assert.match(result.stderr, /- \.husky\/pre-push\n/);
		assert.doesNotMatch(result.stderr, /ok\.ts/);
	});

	test("sees a protected file that is moved out or deleted", () => {
		const f = fixture();
		f.git("mv", "docs/acceptance/core/a.md", "packages/core/src/moved.md");
		const result = f.run(["--pre-commit"]);
		assert.equal(result.status, 1);
		assert.match(result.stderr, /- docs\/acceptance\/core\/a\.md\n/);
	});

	test("allows a worker's commit of other files, and protected changes that are not staged", () => {
		const f = fixture();
		f.write("docs/acceptance/core/a.md", "changed\n");
		f.write("packages/core/src/ok.ts", "ok\n");
		f.git("add", "packages/core/src/ok.ts");
		allowed(f.run(["--pre-commit"]));
	});

	test("allows the owner and the PM to commit protected files", () => {
		const f = fixture();
		f.write("docs/acceptance/core/a.md", "changed\n");
		f.write("agent-guard/check.mjs", "export {};\n");
		f.git("add", "-A");
		allowed(f.run(["--pre-commit"], { thread: "" }));
		allowed(f.run(["--pre-commit"], { thread: "thread:pm" }));
	});
});

describe("--pre-commit and the acceptance fence", () => {
	test("lets the owner commit the conditions alone before any test exists", () => {
		const f = fixture();
		f.write("docs/acceptance/core/db.md", CONDITION["docs/acceptance/core/db.md"]);
		f.git("add", "-A");
		allowed(f.run(["--pre-commit"], { thread: "" }));
	});

	test("blocks a commit that touches the core while a condition has no test, and names the condition", () => {
		const f = fixture(CONDITION);
		f.write("packages/core/package.json", "{}\n");
		f.git("add", "-A");
		for (const thread of ["", "thread:pm", WORKER]) {
			const result = f.run(["--pre-commit"], { thread });
			assert.equal(result.status, 1);
			assert.match(result.stderr, FENCE_FAILED);
		}
	});

	test("lets a commit of the core through when the tests match", () => {
		const f = fixture(CONDITION);
		f.write("packages/core/src/db.test.ts", FENCE_TEST);
		f.git("add", "-A");
		allowed(f.run(["--pre-commit"]));
		allowed(f.run(["--pre-commit"], { thread: "" }));

		f.write("packages/core/src/db.test.ts", UNMARKED_TEST);
		f.git("add", "-A");
		assert.match(f.run(["--pre-commit"], { thread: "" }).stderr, /the line above this expect/);
	});

	test("checks a worker's commit of other code, but not the owner's", () => {
		const f = fixture(CONDITION);
		f.write("scripts/tool.mjs", "export {};\n");
		f.git("add", "-A");
		assert.equal(f.run(["--pre-commit"]).status, 1);
		allowed(f.run(["--pre-commit"], { thread: "" }));
	});

	test("does not run it for a commit that has no code", () => {
		const f = fixture(CONDITION);
		f.write("docs/notes.md", "changed\n");
		f.git("add", "-A");
		allowed(f.run(["--pre-commit"]));
	});

	test("takes a protected file before the fence", () => {
		const f = fixture(CONDITION);
		f.write("docs/acceptance/core/db.md", "changed\n");
		f.write("packages/core/src/a.ts", "export {};\n");
		f.git("add", "-A");
		const result = f.run(["--pre-commit"]);
		assert.equal(result.status, 1);
		assert.match(result.stderr, /Protected files are staged/);
		assert.doesNotMatch(result.stderr, /fence/);
	});
});

describe("without options", () => {
	test("runs the code checks and exits with their result", () => {
		const f = fixture();
		const passed = f.run([], { thread: "" });
		assert.equal(passed.status, 0);
		assert.match(passed.stdout, /lint passed/);

		f.lintFails("lint error");
		const failed = f.run([], { thread: "" });
		assert.equal(failed.status, 1);
		assert.match(failed.stdout, /lint error/);
		assert.equal(f.lintRuns(), 2);
	});

	test("fails on the fence alone, and reports the fence next to a failing lint", () => {
		const f = fixture(CONDITION);
		const fenceOnly = f.run([], { thread: "" });
		assert.equal(fenceOnly.status, 1);
		assert.match(fenceOnly.stdout, /lint passed/);
		assert.match(fenceOnly.stderr, FENCE_FAILED);

		f.lintFails("lint error");
		const both = f.run([], { thread: "" });
		assert.equal(both.status, 1);
		assert.match(both.stdout, /lint error/);
		assert.match(both.stderr, FENCE_FAILED);
		assert.equal(f.lintRuns(), 2);

		f.write("packages/core/src/db.test.ts", FENCE_TEST);
		f.lintPasses();
		assert.equal(f.run([], { thread: "" }).status, 0);
		assert.equal(f.lintRuns(), 3);
	});
});
