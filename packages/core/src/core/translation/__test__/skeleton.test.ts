import { describe, expect, it } from "vitest";
import { ADDED_BLOCKS, ADDED_MARK_BLOCKS, BLOCKS } from "../../../blocks/active";
import { type BlockAttribute, type BlockDefinition, defineBlock } from "../../../blocks/define";
import { compareStructure, readableAttributesByType, readableMdx } from "../skeleton";

/**
 * Site block names are looked up in the current config (runs with both the reference blog config and other site configs). If the config has no such block,
 * that case is skipped. Alignment (`TextAlign`) and files are core blocks, so any config has them.
 */
const stringAttributes = (block: BlockDefinition, translatable: boolean) =>
	Object.entries(block.attributes).filter(
		([, attribute]) =>
			attribute.type === "string" && Boolean(attribute.translatable) === translatable && !attribute.childValue,
	);
/** A value an attribute can take (the `index`-th if it has choices). */
const optionOf = (attribute: BlockAttribute, index: number, fallback: string) =>
	attribute.options ? (Object.keys(attribute.options)[index] ?? fallback) : fallback;

/** A site container with translatable attributes (e.g. callout, quote card). Prefers blocks that also have a choice attribute. */
const siteBoxes = ADDED_BLOCKS.filter(
	(block) => block.syntax.kind === "container" && !block.parent && stringAttributes(block, true).length > 0,
);
const siteBox =
	siteBoxes.find((block) => stringAttributes(block, false).some(([, attribute]) => attribute.options)) ?? siteBoxes[0];
if (!siteBox) throw new Error("skeleton test: the config has no container block with a translatable attribute");
const [titleName] = stringAttributes(siteBox, true)[0] ?? [];
/** A non-translatable choice attribute (if any, e.g. callout kind). */
const kind = stringAttributes(siteBox, false).find(([, attribute]) => attribute.options);
const kindProp = kind ? ` ${kind[0]}="${optionOf(kind[1], 0, "")}"` : "";
/** Text decoration with translatable attributes (e.g. tooltip). */
const markBlock = ADDED_MARK_BLOCKS.find((block) => stringAttributes(block, true).length > 0);
/** A site block with non-translated text attributes (single-line blocks first, e.g. embed address). */
const plainBlock = [
	...ADDED_BLOCKS.filter((block) => block.syntax.kind === "leaf"),
	...ADDED_BLOCKS.filter((block) => block.syntax.kind === "container" && !block.parent),
].find((block) => stringAttributes(block, false).some(([, attribute]) => !attribute.options));
/** A group with an attribute (e.g. default tab) pointing to a child's translatable attribute (e.g. tab name), and that child. */
const labeledGroup = BLOCKS.flatMap((block) => {
	const child = BLOCKS.find((candidate) => candidate.name === block.children?.blocks?.[0]);
	const label = child && stringAttributes(child, true)[0]?.[0];
	const pointer = Object.entries(block.attributes).find(([, attribute]) => attribute.childValue === label)?.[0];
	return child && label && pointer ? [{ block, child, label, pointer }] : [];
})[0];

const Box = siteBox.component;
const SOURCE = [
	`<${Box}${kindProp} ${titleName}="주의할 점">`,
	"**React Query**의 [공식 문서](/posts/react-query)를 보고 `useQuery`를 쓴다.",
	`</${Box}>`,
].join("\n");

describe("translation structure check", () => {
	it("passes when only text and human-readable attributes change", () => {
		const translated = [
			`<${Box}${kindProp} ${titleName}="Things to note">`,
			"Use `useQuery` after reading the [official docs](/posts/react-query) of **React Query**.",
			`</${Box}>`,
		].join("\n");
		// Bold and link positions may move within a sentence.
		expect(compareStructure(SOURCE, translated)).toEqual({ ok: true });
	});

	it("fails when link addresses, inline code or non-human-readable attributes change", () => {
		expect(compareStructure(SOURCE, SOURCE.replace("/posts/react-query", "/posts/other")).ok).toBe(false);
		expect(compareStructure(SOURCE, SOURCE.replace("`useQuery`", "`useQueries`")).ok).toBe(false);
		const align = '<TextAlign align="center">\n가운데\n</TextAlign>';
		expect(compareStructure(align, align.replace('"center"', '"left"')).ok).toBe(false);
		if (kind) {
			const changed = SOURCE.replace(kindProp, ` ${kind[0]}="${optionOf(kind[1], 1, "other")}"`);
			expect(compareStructure(SOURCE, changed).ok).toBe(false);
		}
	});

	it("fails when formatting is removed or a paragraph is split", () => {
		expect(compareStructure(SOURCE, SOURCE.replace("**React Query**", "React Query")).ok).toBe(false);
		expect(compareStructure("첫 문단입니다.", "First paragraph.\n\nSecond paragraph.").ok).toBe(false);
	});

	it("code blocks and image addresses must stay the same, while alt and captions may change", () => {
		const code = "```ts\nconst a = 1;\n```";
		expect(compareStructure(code, code).ok).toBe(true);
		expect(compareStructure(code, "```ts\nconst b = 1;\n```").ok).toBe(false);
		expect(compareStructure("![설정 화면](/a.png)", "![Settings screen](/a.png)").ok).toBe(true);
		expect(compareStructure("![설정 화면](/a.png)", "![Settings screen](/b.png)").ok).toBe(false);
	});

	it.skipIf(!markBlock)("tooltip descriptions may change", () => {
		if (!markBlock) return;
		const [name] = stringAttributes(markBlock, true)[0] ?? [];
		const mark = (text: string, note: string) => `:${markBlock.name}[${text}]{${name}="${note}"}`;
		expect(compareStructure(mark("가", "설명"), mark("A", "Note")).ok).toBe(true);
	});

	it("file names and link titles may change", () => {
		expect(compareStructure('::file{mediaId="m1" label="보고서"}', '::file{mediaId="m1" label="Report"}').ok).toBe(
			true,
		);
		expect(compareStructure('::file{mediaId="m1" label="보고서"}', '::file{mediaId="m2" label="Report"}').ok).toBe(
			false,
		);
		expect(compareStructure('[글](/a "제목")', '[Text](/a "Title")').ok).toBe(true);
	});

	it.skipIf(!labeledGroup)("tab names and the default tab may be translated together", () => {
		if (!labeledGroup) return;
		const { block, child, label, pointer } = labeledGroup;
		const tabs = (first: string, second: string, a: string, b: string) =>
			[
				`<${block.component} ${pointer}="${first}">`,
				`<${child.component} ${label}="${first}">\n${a}\n</${child.component}>`,
				`<${child.component} ${label}="${second}">\n${b}\n</${child.component}>`,
				`</${block.component}>`,
			].join("\n");
		expect(compareStructure(tabs("하나", "둘", "가", "나"), tabs("One", "Two", "A", "B")).ok).toBe(true);
	});

	it("fails when hint text remains or the MDX is broken", () => {
		expect(compareStructure("가나다", ":untranslated[가나다]").ok).toBe(false);
		expect(compareStructure("가나다", `<${Box}>열고 닫지 않음`).ok).toBe(false);
		expect(readableMdx(`<${Box}>열고 닫지 않음`).ok).toBe(false);
		expect(readableMdx("정상 문단").ok).toBe(true);
	});

	it("site blocks may change only their translatable attributes", () => {
		// In the example config the callout has `title` as a translatable attribute; the quote card in another site config has `author`.
		const box = (props: string, title: string, body: string) =>
			`:::${siteBox.name}{${[props, `${titleName}="${title}"`].filter(Boolean).join(" ")}}\n${body}\n:::`;
		const notice = box(kindProp.trim(), "공지 제목", "안내 글");
		expect(compareStructure(notice, box(kindProp.trim(), "Notice title", "Notice text"))).toEqual({ ok: true });
		if (kind) {
			const changed = `${kind[0]}="${optionOf(kind[1], 1, "other")}"`;
			expect(compareStructure(notice, box(changed, "Notice title", "Notice text")).ok).toBe(false);
		}
	});

	it.skipIf(!plainBlock)("site block attributes that are not translatable must stay the same", () => {
		if (!plainBlock) return;
		// `url` of the user block `embed` in the example config.
		const [name] = stringAttributes(plainBlock, false).find(([, attribute]) => !attribute.options) ?? [];
		const colons = plainBlock.syntax.kind === "leaf" ? "::" : ":::";
		const body = plainBlock.syntax.kind === "leaf" ? "" : "\n본문\n:::";
		const block = (url: string) => `${colons}${plainBlock.name}{${name}="${url}"}${body}`;
		expect(compareStructure(block("https://a.example"), block("https://b.example")).ok).toBe(false);
	});

	it("human-readable attributes are decided by the block definition", () => {
		const card = defineBlock({
			name: "card",
			label: "카드",
			syntax: { kind: "container", directive: "card" },
			component: "Card",
			attributes: {
				heading: { type: "string", label: "머리말", translatable: true },
				tone: { type: "string", label: "색" },
			},
			children: { blocks: ["face"] },
			editor: { view: "opaque" },
		});
		const face = defineBlock({
			name: "face",
			label: "면",
			syntax: { kind: "container", directive: "face" },
			component: "Face",
			attributes: { name: { type: "string", label: "이름", translatable: true } },
			editor: { view: "opaque" },
		});
		const deck = defineBlock({
			name: "deck",
			label: "묶음",
			syntax: { kind: "container", directive: "deck" },
			component: "Deck",
			attributes: { first: { type: "string", label: "처음 면", childValue: "name" } },
			children: { blocks: ["face"] },
			editor: { view: "opaque" },
		});
		const readable = readableAttributesByType([card, face, deck]);
		expect([...(readable.get("Card") ?? [])]).toEqual(["heading"]);
		expect([...(readable.get("card") ?? [])]).toEqual(["heading"]);
		// An attribute pointing to a translatable child attribute changes too (tab name ↔ initially open tab).
		expect([...(readable.get("Deck") ?? [])]).toEqual(["first"]);
		expect(readable.get("link")).toEqual(new Set(["title"]));
	});
});

describe("structure check failure reasons", () => {
	it("returns both the reason code and the reason text built from the dictionary", async () => {
		const { createTranslator } = await import("../../../i18n");
		const { translationMessages } = await import("../messages");
		const t = createTranslator(translationMessages);
		expect(compareStructure("a\n\n`x`", "a\n\n`y`")).toEqual({
			ok: false,
			code: "structure_changed",
			reason: t("structure_changed"),
		});
		expect(compareStructure("a", "<Unknown />\n")).toMatchObject({ ok: false, code: "mdx_error" });
		expect(compareStructure("<Unknown />\n", "a")).toEqual({
			ok: false,
			code: "source_unreadable",
			reason: t("source_unreadable"),
		});
		expect(readableMdx("<Unknown />\n")).toMatchObject({ ok: false, code: "mdx_error" });
	});
});
