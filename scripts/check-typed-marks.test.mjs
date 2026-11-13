import assert from "node:assert/strict";
import { test } from "node:test";
import { problems } from "./check-typed-marks.mjs";

const SCREEN = "packages/admin/src/screens/list/screen.tsx";
const UI = 'import { Button, IconButton, MenuShortcut, TextButton, DropdownMenuSubTrigger } from "@monti-cms/ui";\n';
/** The rule and the first words of each problem in one screen, as `line rule: words`. */
const check = (body, file = SCREEN) =>
	problems({ [file]: `${UI}export function Screen({ t, label }) {\n\treturn (\n${body}\n\t);\n}\n` }).map(
		({ line, rule, message }) => `${line} ${rule}: ${message.split(":")[0]}`,
	);

test("labels with their icon, keys passed as keys, a tooltip as a part: nothing to fix", () => {
	assert.deepEqual(
		check(`<>
	<Button><Add aria-hidden />{t("list.new")}</Button>
	<MenuShortcut keys={["Delete"]} />
	<DropdownMenuSubTrigger>{label}</DropdownMenuSubTrigger>
	<span title="whole words">{label}</span>
	{"+1"}
</>`),
		[],
	);
});

test('a "+" typed before a label, in JSX text, a string or a template, is found', () => {
	assert.deepEqual(
		check(`<>
	<Button>+ 새 폴더</Button>
	<Button>{"+ 태그 추가"}</Button>
	<Button>{\`+ \${t("folders.new")}\`}</Button>
</>`),
		['5 typed-glyph: "+ 새 폴더"', '6 typed-glyph: "+ 태그 추가"', '7 typed-glyph: "+ …"'],
	);
});

test("a close mark typed as a button's words and typed keys are found; a size's × and a key compared in code are not", () => {
	assert.deepEqual(
		check(`<>
	<TextButton>×</TextButton>
	<span aria-hidden>×</span>
	<MenuShortcut>Del</MenuShortcut>
	<MenuShortcut>{"⇧⌘D"}</MenuShortcut>
	<span onKeyDown={(event) => event.key === "Backspace" || event.key === "Delete"} />
</>`),
		['5 typed-glyph: "×"', '7 typed-glyph: "Del"', '8 typed-glyph: "⇧⌘D"'],
	);
});

test("a dictionary's words are read, a key's name among them too", () => {
	const found = problems({
		"packages/admin/src/messages.ts":
			'export const ko = {\n\t"list.new": "+ 새 {label}",\n\t"menu.delete": "Del",\n\t"list.open": "열기",\n};\n',
	}).map(({ line, message }) => `${line}: ${message.split(":")[0]}`);
	assert.deepEqual(found, ['2: "+ 새 {label}"', '3: "Del"']);
});

test("a title on a button and a row's › turned off are found; a title on other elements is not", () => {
	assert.deepEqual(
		check(`<>
	<Button title="Save">{label}</Button>
	<IconButton label="More" title="More" />
	<TextButton variant="quiet" title={label}>{label}</TextButton>
	<DropdownMenuSubTrigger chevron={false}>{label}</DropdownMenuSubTrigger>
	<td title={label}>{label}</td>
</>`),
		[
			"5 button-title: `title` on <Button>",
			"6 button-title: `title` on <IconButton>",
			"7 button-title: `title` on <TextButton>",
			"8 chevron-off: `chevron={false}`",
		],
	);
});

test("comments and imports are not read", () => {
	assert.deepEqual(
		check(`<>\n\t{/* "+ 키 추가" opens the window; Del puts a row in the trash */}\n\t{label}\n</>`),
		[],
	);
});

test("values inside `as const` and `satisfies` are read, a key's name through a condition is shown, and aria-keyshortcuts is not", () => {
	const found = problems({
		[SCREEN]: `${UI}const ITEMS = [{ label: "+ 새 글" }] as const;\nconst KEYS = { open: "⌘K" } satisfies Record<string, string>;\nexport function Screen({ open }) {\n\treturn (\n<>\n\t<MenuShortcut>{open && "Del"}</MenuShortcut>\n\t<MenuShortcut>{open ? "Esc" : null}</MenuShortcut>\n\t<button aria-keyshortcuts="Backspace" />\n</>\n\t);\n}\n`,
	}).map(({ line, message }) => `${line}: ${message.split(":")[0]}`);
	assert.deepEqual(found, ['2: "+ 새 글"', '3: "⌘K"', '7: "Del"', '8: "Esc"']);
});
