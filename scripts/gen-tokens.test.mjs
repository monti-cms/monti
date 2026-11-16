import assert from "node:assert/strict";
import test from "node:test";
import { codeHueProblems } from "./gen-tokens.mjs";

const tokens = (code) => ({
	color: {
		tokens: [
			{ name: "fg-danger", value: { light: "#a8353c", dark: "#e3918f" } },
			{ name: "fg-warning", value: { light: "#9a6200", dark: "#d9aa66" } },
			{ name: "fg-success", value: { light: "#336a4f", dark: "#86c09c" } },
			...code,
		],
	},
});

test("code hue: one within 25 degrees of danger is refused in the mode it is, one 25 degrees or more away passes", () => {
	// #9c2663 (the old rose) is a hue near danger's; #913f82 (the magenta) and #6b3fa0 (the violet) are far from all three statuses.
	assert.deepEqual(
		codeHueProblems(tokens([{ name: "code-magenta", value: { light: "#913f82", dark: "#cc8dbe" } }])),
		[],
	);
	const refused = codeHueProblems(tokens([{ name: "code-rose", value: { light: "#a8353c", dark: "#cc8dbe" } }]));
	assert.equal(refused.length, 1);
	assert.match(refused[0], /^code-rose \(light\): hue 21 is 0 degrees from fg-danger, under 25$/);
});

test("code hue: warning and success count too, in the dark mode as well, and a token that is not a code hue is left alone", () => {
	const found = codeHueProblems(
		tokens([
			{ name: "code-orange", value: { light: "#913f82", dark: "#d9aa66" } },
			{ name: "code-green", value: { light: "#336a4f", dark: "#cc8dbe" } },
			{ name: "gray-1", value: { light: "#a8353c", dark: "#a8353c" } },
		]),
	);
	assert.deepEqual(
		found.map((line) => line.split(": ")[0]),
		["code-green (light)", "code-orange (dark)"],
	);
	assert.match(found[0], /from fg-success/);
	assert.match(found[1], /from fg-warning/);
});

test("code hue: the tokens of the design system pass", async () => {
	const { readFileSync } = await import("node:fs");
	const json = JSON.parse(readFileSync(new URL("../packages/ui/tokens/tokens.json", import.meta.url), "utf8"));
	assert.deepEqual(codeHueProblems(json), []);
});
