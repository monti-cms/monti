import assert from "node:assert/strict";
import test from "node:test";
import { OLD_READ_PARTS, oneBody } from "./check-read-body.mjs";

test("one-body: each old read-only part, named in a source of a package, fails with its line", () => {
	const found = oneBody({
		"packages/admin/src/a.tsx": OLD_READ_PARTS.map((name) => `const x = <${name} />;`).join("\n"),
	});
	assert.deepEqual(
		found.map(({ line }) => line),
		OLD_READ_PARTS.map((_, index) => index + 1),
	);
	assert.match(found[0].message, /shownBlocks/);
});

test("one-body: a comment, a story and a test count too, since there is no list of files that may", () => {
	const found = oneBody({
		"packages/ui/src/a.stories.tsx": "<CompareParagraph>words</CompareParagraph>",
		"packages/admin/src/b.test.tsx": "// the old DocTable is gone",
		"examples/blog/app/c.ts": "export const ReadBlock = 1;",
	});
	assert.deepEqual(
		found.map(({ file }) => file),
		["packages/ui/src/a.stories.tsx", "packages/admin/src/b.test.tsx", "examples/blog/app/c.ts"],
	);
});

test("one-body: a longer name, other places and the docs are not the old parts", () => {
	assert.deepEqual(
		oneBody({
			"packages/admin/src/a.tsx":
				"const ReadBlocks = 1; const DocCodeBlock = 2; const mushownBlocks = 3; <ReadBody />;",
			"scripts/check-read-body.mjs": "shownBlocks",
			"docs/design/admin/components/status.md": "shownBlocks",
			"packages/admin/node_modules/x/index.ts": "shownBlocks",
		}),
		[],
	);
});
