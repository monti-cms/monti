import assert from "node:assert/strict";
import { test } from "node:test";
import {
	assistantPlace,
	cutWords,
	dangerSeparator,
	koTexts,
	monoProps,
	ownGlyph,
	requiredMark,
} from "./check-parts.mjs";

test("own-glyph: a hand-drawn svg in a part is named, a listed file passes, a listed file with no svg fails, a comment is not a drawing", () => {
	const found = ownGlyph(
		{
			"packages/ui/src/new.tsx": 'export const A = () => <svg viewBox="0 0 8 8" />;\n',
			"packages/ui/src/listed.tsx": "export const B = () => <svg />;\n",
			"packages/ui/src/said.ts": "/** An icon that draws an `<svg>` and takes a size. */\nexport const C = 1;\n",
		},
		{
			allowed: new Map([
				["ui/src/listed.tsx", "a stroke tuned to its size"],
				["ui/src/gone.tsx", "was drawn once"],
			]),
		},
	);
	assert.equal(found.length, 2);
	assert.equal(found[0].file, "packages/ui/src/new.tsx");
	assert.equal(found[0].line, 1);
	assert.match(found[1].message, /no svg any more/);
});

test("assistant-place: the ✦ button's name is read in one file, a second reference ✦ and a corner on the inset are named", () => {
	const one = { "packages/admin/src/assistant/assistant-button.tsx": 't("frame.assistant")' };
	assert.deepEqual(assistantPlace(one), []);
	const two = assistantPlace({
		...one,
		"packages/admin/src/screens/frame/admin-frame.tsx": 'label={t("frame.assistant")}',
	});
	assert.equal(two.length, 1);
	assert.match(two[0].message, /2 files/);
	const none = assistantPlace({ "packages/admin/src/a.tsx": "export {}" });
	assert.match(none[0].message, /0 files/);
	const more = assistantPlace({
		...one,
		"packages/ui/src/screens/reference/frame.tsx": '<IconButton label="어시스턴트 열기" />',
		"packages/ui/src/screens/reference/editor.tsx": '<IconButton label="어시스턴트 열기" />',
		"packages/ui/src/page.tsx": "<SidebarInset fixed corner={<Spark />}>x</SidebarInset>",
	});
	assert.equal(more.length, 2);
	assert.match(more[0].message, /ReferenceAssistant/);
	assert.match(more[1].message, /no corner/);
});

test("cut-words: a part that cuts words in a class without CutWords is named; one that imports it, a listed one and a prop are not", () => {
	const found = cutWords(
		{
			"packages/ui/src/bare.tsx": 'export const A = () => <span className="min-w-0 truncate">x</span>;\n',
			"packages/ui/src/variant.tsx": 'export const B = "*:data-[slot=value]:line-clamp-1 flex";\n',
			"packages/ui/src/wrapped.tsx":
				'import { CutWords } from "./cut-words";\nexport const C = () => <CutWords className="truncate">x</CutWords>;\n',
			"packages/ui/src/listed.tsx": 'export const D = "truncate";\n',
			"packages/ui/src/prop.tsx": "export const E = () => <Text truncate>x</Text>;\n",
			"packages/ui/src/stale-name.tsx": 'export const F = "truncated-looking";\n',
		},
		{
			allowed: new Map([
				["ui/src/listed.tsx", "shown whole elsewhere"],
				["ui/src/gone.tsx", "was cut once"],
			]),
		},
	);
	assert.deepEqual(
		found.map((each) => each.file),
		[
			"packages/ui/src/bare.tsx",
			"packages/ui/src/variant.tsx",
			"packages/gone.tsx".replace("packages/", "packages/ui/src/"),
		],
	);
	assert.match(found[2].message, /no longer cuts/);
});

test("menu-danger-separator: a danger row after another row is named; first, after a rule, after a condition that holds one, or alone is not", () => {
	const menu = (body) => `export const M = () => (<DropdownMenuContent>${body}</DropdownMenuContent>);\n`;
	const bad = dangerSeparator({
		"packages/admin/src/a.tsx": menu(
			'<DropdownMenuItem>복제</DropdownMenuItem><DropdownMenuItem variant="danger">지우기</DropdownMenuItem>',
		),
	});
	assert.equal(bad.length, 1);
	assert.equal(bad[0].line, 1);
	const fine = dangerSeparator({
		"packages/admin/src/first.tsx": menu('<DropdownMenuItem variant="danger">지우기</DropdownMenuItem>'),
		"packages/admin/src/rule.tsx": menu(
			'<DropdownMenuItem>복제</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="danger">지우기</DropdownMenuItem>',
		),
		"packages/admin/src/alias.tsx": menu('<Item>복제</Item><Separator /><Item variant="danger">지우기</Item>'),
		"packages/admin/src/condition.tsx": menu(
			'{can ? (<><DropdownMenuItem>고치기</DropdownMenuItem><DropdownMenuSeparator /></>) : null}<DropdownMenuItem variant="danger">지우기</DropdownMenuItem>',
		),
		"packages/admin/src/comment.tsx": menu(
			'{/* the only row */}<DropdownMenuItem variant="danger">지우기</DropdownMenuItem>',
		),
	});
	assert.deepEqual(fine, []);
});

test("required-mark: a typed ' !' after a name, a '*' typed in JSX and a legend that starts with '!' are named; the label's own star is not", () => {
	const found = requiredMark({
		// biome-ignore lint/suspicious/noTemplateCurlyInString: source text under test
		"packages/admin/src/a.tsx": "const name = (def) => (def.required ? `${key} !` : key);\n",
		"packages/admin/src/b.tsx": "export const B = () => <span>*</span>;\n",
		"packages/ui/src/label.tsx": "export const L = () => <span>*</span>;\n",
		"packages/admin/src/messages.ts": 'export const m = { "settings.fields.legend": "! 필수 · → 관계" };\n',
		// biome-ignore lint/suspicious/noTemplateCurlyInString: source text under test
		"packages/admin/src/c.tsx": "const price = `${a} ! ${b}`;\n",
	});
	assert.deepEqual(
		found.map((each) => each.file),
		["packages/admin/src/a.tsx", "packages/admin/src/b.tsx", "packages/admin/src/messages.ts"],
	);
});

const dictionary =
	'export const m = { en: { "k.words": "Words" }, ko: { "k.words": "낱말", "k.mono": "monti.config.ts", "k.plural": "{count}개" } };';

test("mono-props: Korean words set mono through an option are named, by literal, by t() and in a meta; values and conditions are not", () => {
	const texts = koTexts([dictionary]);
	assert.equal(texts.get("k.words"), "낱말");
	const found = monoProps(
		{
			"packages/admin/src/literal.tsx": "export const A = () => <Text mono>공개 주소</Text>;\n",
			"packages/admin/src/key.tsx": 'export const B = () => <Text mono>{t("k.words")}</Text>;\n',
			"packages/ui/src/meta.tsx": '<ListSectionRow title="언어" meta="한국어" metaMono />;\n',
			"packages/ui/src/title.tsx": '<SheetTitle of="필드" ofMono>x</SheetTitle>;\n',
			"packages/admin/src/value.tsx": 'export const C = () => <Text mono>{t("k.mono")}</Text>;\n',
			"packages/admin/src/count.tsx": 'export const D = () => <Text mono>{t("k.plural", { count })}</Text>;\n',
			"packages/admin/src/off.tsx": "export const E = () => <Text mono={false}>낱말</Text>;\n",
			"packages/ui/src/other-value.tsx": '<ListSectionRow title="언어" meta="ko" metaMono />;\n',
			"packages/admin/src/mixed.tsx":
				'export const F = ({ path }) => <Text mono={typeof path === "string"}>{t("k.words")}</Text>;\n',
		},
		{ texts, allowed: new Map([["admin/src/mixed.tsx", "an address, or words when there is none"]]) },
	);
	// A count's unit ("개") is a word too: it is named with the rest.
	assert.deepEqual(found.map((each) => each.file).sort(), [
		"packages/admin/src/count.tsx",
		"packages/admin/src/key.tsx",
		"packages/admin/src/literal.tsx",
		"packages/ui/src/meta.tsx",
		"packages/ui/src/title.tsx",
	]);
	assert.match(found.find((each) => each.file.endsWith("meta.tsx")).message, /metaMono/);
});

test("mono-props: a screen's children the rule cannot read need the file named with a reason, and a listed file with none fails", () => {
	const sources = {
		"packages/admin/src/dynamic.tsx": "export const A = ({ code }) => <Text mono>{code}</Text>;\n",
		"packages/admin/src/listed.tsx": "export const B = ({ code }) => <Text mono>{code}</Text>;\n",
		"packages/admin/src/input.tsx": "export const C = ({ slug }) => <Input mono value={slug} />;\n",
		"packages/ui/src/part.tsx": "export const D = ({ code }) => <Text mono>{code}</Text>;\n",
	};
	const found = monoProps(sources, {
		allowed: new Map([
			["admin/src/listed.tsx", "an identifier"],
			["admin/src/input.tsx", "a typed address"],
			["admin/src/gone.tsx", "was a value once"],
		]),
	});
	assert.deepEqual(
		found.map((each) => each.file),
		["packages/admin/src/dynamic.tsx", "packages/admin/src/gone.tsx"],
	);
	assert.match(found[0].message, /MONO_PROP_VALUES/);
	assert.match(found[1].message, /no mono option/);
});
