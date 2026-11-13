// The check of browser test names (scripts/check-test-titles.mjs): which names are too long for the picture a failure leaves.
import assert from "node:assert/strict";
import { test } from "node:test";
import { LONGEST, tooLong } from "./check-test-titles.mjs";

const long = "a".repeat(LONGEST);

test("a test's name is its describes and its title, joined: over the limit it is named with its line", () => {
	const source = [
		'describe("the outer group", () => {',
		`\tit("${long}", async () => {});`,
		'\tit("a short one", async () => {});',
		'\tdescribe("an inner group", () => {',
		`\t\ttest("${"b".repeat(LONGEST - "the outer group an inner group ".length)}", () => {});`,
		`\t\ttest("${"c".repeat(LONGEST - "the outer group an inner group ".length + 1)}", () => {});`,
		"\t});",
		"});",
		// A group that ended is no part of a later test's name.
		`it("${"d".repeat(LONGEST)}", async () => {});`,
	].join("\n");
	assert.deepEqual(
		tooLong(source).map(({ line, length }) => [line, length]),
		[
			[2, LONGEST + "the outer group ".length],
			[6, LONGEST + 1],
		],
	);
});

test("a describe of another runner's name and a test given by `it.skip` count the same", () => {
	const source = [`raw.describe("${long}", () => {`, '\tit.skip("x", async () => {});', "});"].join("\n");
	assert.deepEqual(
		tooLong(source).map(({ line }) => line),
		[2],
	);
});
