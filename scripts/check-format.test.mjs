import assert from "node:assert/strict";
import { test } from "node:test";
import { problems } from "./check-format.mjs";

const SCREEN = "packages/admin/src/screens/list/list-screen.tsx";
/** What the check finds in one screen, as `line: first word`. */
const check = (text, file = SCREEN) =>
	problems({ [file]: text }).map(({ line, message }) => `${line}: ${message.split(":")[0]}`);

test("a screen that asks format/ for its dates, sizes and names: nothing to fix", () => {
	assert.deepEqual(
		check(
			'import { shortDate } from "../../format/date";\nexport const cell = (at, language) => shortDate(at, language);\nconst count = (5).toLocaleString();\n',
		),
		[],
	);
});

test("a date or a language's name built with Intl in a screen is named with its line", () => {
	assert.deepEqual(
		check(
			'const a = new Intl.DateTimeFormat("ko").format(date);\nconst b = new Intl.DisplayNames(["ko"], { type: "language" });\nconst c = Intl["RelativeTimeFormat"];\n',
		),
		["1: Intl.DateTimeFormat", "2: Intl.DisplayNames", "3: Intl.RelativeTimeFormat"],
	);
	// Numbers and plurals are not dates.
	assert.deepEqual(check('const n = new Intl.NumberFormat("ko");\nconst p = new Intl.PluralRules("ko");\n'), []);
});

test("a date built by hand: padStart, a date's part in a template, the browser's own date words", () => {
	assert.deepEqual(check('const two = (value) => String(value).padStart(2, "0");\n'), ["1: .padStart()"]);
	assert.deepEqual(
		// biome-ignore lint/suspicious/noTemplateCurlyInString: the checked source holds a template.
		check("const day = `${date.getMonth() + 1}. ${date.getDate()}`;\n"),
		["1: .getMonth() in a template", "1: .getDate() in a template"],
	);
	assert.deepEqual(check("const a = date.toLocaleDateString();\nconst b = date.toLocaleTimeString('ko');\n"), [
		"1: .toLocaleDateString()",
		"2: .toLocaleTimeString()",
	]);
	// A date's part read for arithmetic is no written date.
	assert.deepEqual(check("const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);\n"), []);
});

test("a code in capitals is not a name", () => {
	assert.deepEqual(check("export const Cell = ({ locale }) => <span>{locale.toUpperCase()}</span>;\n"), [
		"1: .toUpperCase()",
	]);
});

test("format/ itself, tests, stories and other packages are not read", () => {
	const text = 'const a = new Intl.DateTimeFormat("ko");\nconst b = code.toUpperCase();\n';
	for (const file of [
		"packages/admin/src/format/date.ts",
		"packages/admin/src/format/format.test.ts",
		"packages/admin/src/screens/list/list.screen.test.tsx",
		"packages/admin/src/screens/list/list.stories.tsx",
		"packages/ui/src/locale-codes.tsx",
	])
		assert.deepEqual(check(text, file), []);
});
