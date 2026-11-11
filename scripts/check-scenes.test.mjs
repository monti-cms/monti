import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { problems } from "./check-scenes.mjs";

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
});
