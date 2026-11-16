import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { monoWords, tabular, typeOrder } from "./check-type-colour.mjs";

const tokens = JSON.parse(readFileSync(new URL("../packages/ui/tokens/tokens.json", import.meta.url), "utf8"));
const editorBody = readFileSync(new URL("../packages/ui/src/editor-body.tsx", import.meta.url), "utf8");
const adminCss = readFileSync(new URL("../packages/ui/styles/admin.css", import.meta.url), "utf8");

test("mono-words: a file that draws mono with no reason is named with its line", () => {
	const found = monoWords(
		{ "packages/ui/src/new.tsx": 'export const A = () => <span className="font-mono">한글</span>;\n' },
		{ allowed: new Map() },
	);
	assert.equal(found.length, 1);
	assert.match(found[0].message, /font-mono/);
	assert.equal(found[0].line, 1);
});

test("mono-words: the small roles need a reason too, a listed file passes and a listed file that stopped using them fails", () => {
	const allowed = new Map([
		["ui/src/a.tsx", "an address"],
		["ui/src/gone.tsx", "was an address"],
	]);
	const found = monoWords(
		{
			"packages/ui/src/a.tsx": '<span className="text-monti-meta">x</span>',
			"packages/ui/src/b.tsx": '<span className="text-monti-micro">x</span>',
			"packages/ui/src/gone.tsx": "export const A = 1;",
		},
		{ allowed },
	);
	assert.deepEqual(
		found.map((each) => each.file),
		["packages/ui/src/b.tsx", "packages/ui/src/gone.tsx"],
	);
	assert.match(found[1].message, /no longer uses/);
});

test("mono-words: tests and stories are not read, and a mono family on a small role in the theme fails", () => {
	assert.deepEqual(
		monoWords(
			{ "packages/ui/src/a.stories.tsx": "font-mono", "packages/ui/src/a.test.tsx": "font-mono" },
			{ allowed: new Map() },
		),
		[],
	);
	const theme =
		"@utility text-monti-meta {\n\tfont-family: var(--monti-font-mono);\n}\n@utility text-monti-micro {\n\tfont-family: var(--monti-family, var(--monti-font-sans));\n}";
	const found = monoWords({}, { allowed: new Map(), themeCss: theme });
	assert.equal(found.length, 1);
	assert.match(found[0].message, /text-monti-meta sets the mono family/);
});

test("mono-words: the repository's own files pass", () => {
	const theme = readFileSync(new URL("../packages/ui/styles/theme.css", import.meta.url), "utf8");
	assert.deepEqual(monoWords({}, { allowed: new Map(), themeCss: theme }), []);
});

test("type-order: the repository's tokens and editor body pass", () => {
	assert.deepEqual(typeOrder(tokens, editorBody), []);
});

test("type-order: an h3 larger than the h2, and an h4 smaller than the text, are caught (ET-01)", () => {
	const swapped = editorBody
		.replace("[&_h3]:mt-monti-32 [&_h3]:mb-monti-12 [&_h3]:text-monti-subheading", "[&_h3]:text-monti-page")
		.replace("[&_h4]:text-monti-reading", "[&_h4]:text-monti-title");
	const found = typeOrder(tokens, swapped);
	assert.equal(found.length, 2);
	assert.match(found[0].message, /h3 \(26px\) is larger than the heading above it \(22px\)/);
	assert.match(found[1].message, /h4 \(16px\) is smaller than the text \(17px\)/);
});

test("type-order: an h4 at the text's size without a weight is caught, and so are heading roles that do not step down", () => {
	assert.match(typeOrder(tokens, editorBody.replace("[&_h4]:font-semibold", "")).at(0).message, /set apart by weight/);
	const flat = structuredClone(tokens);
	for (const group of flat.type.groups)
		for (const style of group.styles) if (style.name === "text-subheading") style.fontSize = "22px";
	assert.match(
		typeOrder(flat, editorBody).at(0).message,
		/text-subheading \(22px\) is not smaller than text-heading \(22px\)/,
	);
});

test("tabular: admin.css sets tabular digits on the root and the body; a rule without them is caught", () => {
	assert.deepEqual(tabular(adminCss), []);
	const without = adminCss.replaceAll("font-variant-numeric: tabular-nums;", "");
	assert.equal(tabular(without).length, 2);
});

test("tabular: a source that takes the digits back is caught", () => {
	const found = tabular(adminCss, { "packages/ui/src/a.tsx": '<span className="normal-nums">9</span>' });
	assert.equal(found.length, 1);
	assert.match(found[0].message, /takes back/);
});
