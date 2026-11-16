import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
	APP_ROOT_FILE,
	FIELD_FILES,
	monoWords,
	SCREEN_MODE_FILE,
	saturation,
	screenModeRoot,
	tabular,
	tokenContrast,
	typeMerge,
	typeOrder,
} from "./check-type-colour.mjs";

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

test("mono-words: the small role needs a reason too, a listed file passes and a listed file that stopped using them fails", () => {
	const allowed = new Map([
		["ui/src/a.tsx", "an address"],
		["ui/src/gone.tsx", "was an address"],
	]);
	const found = monoWords(
		{
			"packages/ui/src/a.tsx": '<span className="text-monti-micro">x</span>',
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
	const theme = "@utility text-monti-micro {\n\tfont-family: var(--monti-font-mono);\n}";
	const found = monoWords({}, { allowed: new Map(), themeCss: theme });
	assert.equal(found.length, 1);
	assert.match(found[0].message, /text-monti-micro sets the mono family/);
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

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const own = Object.fromEntries([...FIELD_FILES, "packages/ui/src/table.tsx"].map((file) => [file, read(file)]));
const modeFiles = { [SCREEN_MODE_FILE]: read(SCREEN_MODE_FILE), [APP_ROOT_FILE]: read(APP_ROOT_FILE) };

test("screen-mode-root: the repository's hook and root pass", () => {
	assert.deepEqual(screenModeRoot(modeFiles), []);
});

test("screen-mode-root: a screen that writes data-theme or applies the mode itself is caught (TT-01)", () => {
	const found = screenModeRoot({
		...modeFiles,
		"packages/admin/src/screens/frame/admin-frame.tsx":
			'import { useApplyScreenMode } from "./use-screen-mode";\nexport function F() { useApplyScreenMode(); document.documentElement.dataset.theme = "dark"; }',
	});
	assert.equal(found.length, 2);
	assert.match(found[0].message, /use-screen-mode\.ts. alone/);
	assert.match(found[1].message, /called once/);
});

test("screen-mode-root: a root that does not apply the mode is caught", () => {
	const found = screenModeRoot({
		...modeFiles,
		[APP_ROOT_FILE]: modeFiles[APP_ROOT_FILE].replace("useApplyScreenMode();", ""),
	});
	assert.equal(found.length, 1);
	assert.match(found[0].message, /MontiAdmin. must call/);
});

test("screen-mode-root: reading the mode in the switch is free", () => {
	assert.deepEqual(
		screenModeRoot({
			...modeFiles,
			"packages/admin/src/screens/frame/admin-frame.tsx": "const [mode, setMode] = useScreenMode();",
		}),
		[],
	);
});

test("token-contrast: the repository's tokens, field files and table pass", () => {
	assert.deepEqual(tokenContrast(tokens, { sources: own }), []);
});

const withToken = (name, mode, value) => {
	const copy = structuredClone(tokens);
	copy.color.tokens.find((token) => token.name === name).value[mode] = value;
	return copy;
};

test("token-contrast: a field underline back at the quiet stroke (1.7:1) is caught (PP-62)", () => {
	const found = tokenContrast(withToken("border-strong", "dark", "{gray-7}"), { sources: own });
	assert.match(found[0].message, /border-strong on bg-page \(dark\).* under 3:1/);
});

test("token-contrast: a dark pill as bright as the ink is caught (LD-02)", () => {
	const found = tokenContrast(withToken("bg-emphasis", "dark", "{gray-12}"), { sources: own });
	assert.ok(found.some((each) => /dark pill .* not at least 1.2:1 darker than the ink/.test(each.message)));
});

test("token-contrast: text under 4.5:1 and a loud dark state colour are caught", () => {
	assert.match(
		tokenContrast(withToken("fg-subtle", "light", "{gray-8}"), { sources: own })[0].message,
		/fg-subtle on bg-page \(light\)/,
	);
	const loud = tokenContrast(withToken("proposal-11", "dark", "#93adf5"), { sources: own });
	assert.match(loud[0].message, /proposal-11 \(dark\) #93adf5 is 83% saturated/);
	assert.ok(saturation("#a6b7ea") <= 0.66);
});

test("token-contrast: the sidebar and the page drawn as one ground in dark are caught (LD-05)", () => {
	const found = tokenContrast(withToken("gray-1", "dark", "#151412"), { sources: own });
	assert.match(found[0].message, /two grounds/);
});

test("token-contrast: a picked row with no left bar is caught, where hover and picked are 1.05:1 apart (AT-22)", () => {
	const found = tokenContrast(tokens, {
		sources: {
			...own,
			"packages/ui/src/table.tsx": own["packages/ui/src/table.tsx"].replaceAll(
				"data-selected:[&>td:first-child]:before:bg-(--monti-border-contrast)",
				"",
			),
		},
	});
	assert.equal(found.length, 1);
	assert.match(found[0].message, /left bar/);
});

test("token-contrast: a field that draws its underline with a quiet line is caught", () => {
	const input = FIELD_FILES.find((file) => file.endsWith("input.tsx"));
	const found = tokenContrast(tokens, {
		sources: {
			...own,
			[input]: own[input].replaceAll("border-monti-strong border-b", "border-monti-default border-b"),
		},
	});
	assert.equal(found.length, 1);
	assert.equal(found[0].file, input);
});

test("the showcase site has a dark theme: a prefers-color-scheme rule, and its rules take colours from the variables (WS-01)", () => {
	const css = read("examples/showcase/app/site.css");
	assert.match(css, /@media \(prefers-color-scheme: dark\)/);
	const rules = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/html:has\(\.site\) \{[^}]*\}/g, "");
	assert.deepEqual(rules.match(/#[0-9a-f]{3,8}\b/gi) ?? [], []);
	assert.match(css, /body:has\(\.site\) \{\s*background: var\(--site-bg\);/);
});

test("type-merge: cn knows every type role as a font size; a missing role and a stale name are caught", () => {
	const cnSource = readFileSync(new URL("../packages/ui/src/cn.ts", import.meta.url), "utf8");
	assert.deepEqual(typeMerge(tokens, cnSource), []);
	const missing = typeMerge(tokens, cnSource.replace('"monti-editor-code",', ""));
	assert.match(missing.at(0).message, /text-monti-editor-code is not in cn's font-size group/);
	const stale = typeMerge(tokens, cnSource.replace('"monti-code",', '"monti-code",\n"monti-meta",'));
	assert.match(stale.at(0).message, /names monti-meta, which is not a type role/);
});

test("screen-mode-root: a call in a function written after MontiAdmin does not count as the root's", () => {
	const later =
		modeFiles[APP_ROOT_FILE].replace("useApplyScreenMode();", "") +
		"\nfunction Later() {\n\tuseApplyScreenMode();\n}\n";
	const found = screenModeRoot({ ...modeFiles, [APP_ROOT_FILE]: later });
	assert.equal(found.length, 1);
	assert.match(found[0].message, /MontiAdmin. must call/);
});
