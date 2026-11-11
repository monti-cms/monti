import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { problems, sendsOut } from "./check-scenes.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

const scenes = { reach: { does: "Reach it." }, many: { does: "Many of it." } };
const kinds = {
	floating: { parts: ["BlockHandle"], adminCode: ["useSlashMenu"], ui: ["many"], admin: ["reach"] },
};
const screen = 'import { Box, BlockHandle } from "@monti-cms/ui";\n';
const whole = {
	"packages/admin/src/editor/handle.tsx": screen,
	"packages/admin/src/editor/handle.screen.test.tsx": 'it("[reach] the pointer gets to the handle", async () => {});\n',
	"packages/ui/src/block-handle.browser.test.tsx":
		'import { BlockHandle } from "./index";\nit("[many] a hundred blocks", async () => {});\n',
};
const check = (files) => problems({ scenes, kinds, files });

test("a folder that uses a part has its kind's scenes, and the part has its own: nothing to fix", () => {
	assert.deepEqual(check(whole), []);
});

test("a scene taken out of a folder that uses the part is named with the folder, the scene and how to add it", () => {
	const found = check({
		...whole,
		"packages/admin/src/editor/handle.screen.test.tsx": 'it("the handle shows", () => {});\n',
	});
	assert.equal(found.length, 1);
	assert.match(
		found[0],
		/^packages\/admin\/src\/editor: no test of \[reach\] \(kind floating: BlockHandle in handle\.tsx\)/,
	);
	assert.match(found[0], /Add it\("\[reach\] …"\)/);
	assert.match(found[0], /Reach it\./);
});

test("a test in another folder does not stand in, and the admin's own code of a kind asks for the scenes too", () => {
	const elsewhere = {
		...whole,
		"packages/admin/src/screens/list/list.tsx": screen,
		"packages/admin/src/screens/entry/slash.ts": "export function useSlashMenu() {}\n",
	};
	assert.deepEqual(
		check(elsewhere).map((line) => line.split(":")[0]),
		["packages/admin/src/screens/entry", "packages/admin/src/screens/list"],
	);
});

test("a type-only import, a story and a test are not a use of the part", () => {
	const files = {
		"packages/ui/src/block-handle.browser.test.tsx": whole["packages/ui/src/block-handle.browser.test.tsx"],
		"packages/admin/src/a/a.stories.tsx": screen,
		"packages/admin/src/a/a.screen.test.tsx": screen,
		"packages/admin/src/b/b.tsx": 'import { Box, type BlockHandle } from "@monti-cms/ui";\n',
		"packages/admin/src/c/c.tsx": 'import type { BlockHandle } from "@monti-cms/ui";\n',
	};
	assert.deepEqual(check(files), []);
});

test("the part's own scene is missing when no part test tries it", () => {
	const found = check({
		...whole,
		"packages/ui/src/block-handle.browser.test.tsx": 'it("[many] nothing about the part", () => {});\n',
	});
	assert.equal(found.length, 1);
	assert.match(found[0], /^packages\/ui: no test of \[many\] on a part of kind floating \(BlockHandle\)/);
});

test("a skipped or to-do test tries nothing; to-do and only are refused; a skip passes only with its tracker item", () => {
	const title = "[reach] the pointer gets to the handle";
	const withTest = (call) => check({ ...whole, "packages/admin/src/editor/handle.screen.test.tsx": `${call}\n` });

	const todo = withTest(`it.todo("${title}");`);
	assert.equal(todo.length, 2);
	assert.match(todo[0], /handle\.screen\.test\.tsx:1: .* is still to do/);
	assert.match(todo[1], /no test of \[reach\]/);

	const skipped = withTest(`it.skip("${title}", () => {});`);
	assert.equal(skipped.length, 2);
	assert.match(skipped[0], /skipped without a reason/);

	const waiting = withTest(`it.skip("${title} (T126)", () => {});`);
	assert.equal(waiting.length, 1);
	assert.match(waiting[0], /no test of \[reach\]/);

	assert.match(withTest(`describe.only("x", () => { it("${title}", () => {}); });`)[0], /\.only/);
	assert.deepEqual(withTest(`it.skipIf(!process.env.DB)("${title}", () => {});`), []);
});

test("what does not run tries nothing: a test in a skipped suite, a call in a comment, a suite's own title", () => {
	const withTests = (text) => check({ ...whole, "packages/admin/src/editor/handle.screen.test.tsx": text });
	const title = "[reach] the pointer gets to the handle";
	const missing = /no test of \[reach\]/;

	const inSkipped = withTests(`describe.skip("the handle (T9)", () => {\n\tit("${title}", () => {});\n});\n`);
	assert.equal(inSkipped.length, 1);
	assert.match(inSkipped[0], missing);

	const commented = withTests(
		`// it("${title}", () => {});\n/* it.todo("${title}"); */\nit("the handle shows", () => {});\n`,
	);
	assert.equal(commented.length, 1);
	assert.match(commented[0], missing);

	const onSuite = withTests(`describe("[reach] the handle", () => {\n\tit("shows", () => {});\n});\n`);
	assert.equal(onSuite.length, 2);
	assert.match(onSuite[0], /handle\.screen\.test\.tsx:1: \[reach\] names a suite/);
	assert.match(onSuite[1], missing);
});

test("titles and calls in their other spellings are read: a template over lines, each, a tagged each under only", () => {
	const withTests = (text) => check({ ...whole, "packages/admin/src/editor/handle.screen.test.tsx": text });
	assert.deepEqual(withTests("it(`[reach] the pointer\n\tgets to the handle`, () => {});\n"), []);
	assert.deepEqual(withTests('it.each([1, 2])("[reach] the pointer gets to handle %i", () => {});\n'), []);
	assert.match(withTests('it.only.each([make(1)])("[reach] to the handle", () => {});\n')[0], /\.only/);
	// biome-ignore lint/suspicious/noTemplateCurlyInString: the text of a test file, with its own template
	assert.match(withTests('it.only.each`\n  a\n  ${1}\n`("[reach] to the handle $a", () => {});\n')[0], /\.only/);
	assert.match(
		withTests('test.describe.only("the handle", () => {\n\ttest("[reach] to it", () => {});\n});\n')[0],
		/\.only/,
	);
});

test("a part taken under another name is still a use of the part", () => {
	const found = check({
		"packages/ui/src/block-handle.browser.test.tsx": whole["packages/ui/src/block-handle.browser.test.tsx"],
		"packages/admin/src/a/a.tsx": 'import {\n\tBox,\n\tBlockHandle as Handle,\n} from "@monti-cms/ui";\n',
	});
	assert.equal(found.length, 1);
	assert.match(found[0], /^packages\/admin\/src\/a: no test of \[reach\]/);
});

test("a file that cannot be parsed is named, not passed over", () => {
	const found = check({ ...whole, "packages/admin/src/editor/handle.screen.test.tsx": 'it("[reach] open", () => {\n' });
	assert.match(found[0], /handle\.screen\.test\.tsx: the file cannot be parsed/);
});

test("the hook sees a push or a new pull request among a line's commands, and not their names in words", () => {
	for (const line of [
		"git push",
		"git -C /some/where push -u origin work",
		"echo hi && FOO=1 git push",
		"gh pr create --title x",
		"gh --repo owner/name pr create",
		'sh -c "git push"',
	])
		assert.equal(sendsOut(line), true, line);
	for (const line of [
		'echo "git push"',
		'git commit -m "before git push"',
		"git status",
		"gh pr view 5",
		"git log --grep push",
		"ls",
	])
		assert.equal(sendsOut(line), false, line);
});

test("a tag that is not a scene is refused; brackets that hold more than a name are words", () => {
	const found = check({
		...whole,
		"packages/admin/src/editor/other.screen.test.tsx":
			'it("[raech] a slip", () => {});\nit("11-1 [flow 5·11] words", () => {});\n',
	});
	assert.equal(found.length, 1);
	assert.match(found[0], /other\.screen\.test\.tsx:1: \[raech\] is not a scene/);
});

test("on this repository the check passes, and the hook lets other calls through without running it", () => {
	const run = (args, input = "") =>
		spawnSync("node", [path.join(here, "check-scenes.mjs"), ...args], { encoding: "utf8", input });
	assert.equal(run([]).status, 0);
	const bash = (command) => JSON.stringify({ tool_name: "Bash", tool_input: { command } });
	assert.equal(run(["--hook"], bash("ls")).status, 0);
	assert.equal(run(["--hook"], "not JSON").status, 0);
	assert.equal(run(["--hook"], bash("git push -u origin work")).status, 0);
	assert.equal(run(["--notice"]).stdout, "");
	// A check that cannot run (here: Node told not to read TypeScript) holds the call with the hook's stopping code, and says why.
	const cannot = spawnSync("node", ["--no-experimental-strip-types", path.join(here, "check-scenes.mjs"), "--hook"], {
		encoding: "utf8",
		input: bash("git push"),
	});
	assert.equal(cannot.status, 2);
	assert.match(cannot.stderr, /could not run, so this call is held/);
});
