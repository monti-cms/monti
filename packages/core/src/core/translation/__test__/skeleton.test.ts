import { describe, expect, it } from "vitest";
import { ADDED_BLOCKS, ADDED_MARK_BLOCKS, BLOCKS } from "../../../blocks/active";
import { type BlockAttribute, type BlockDefinition, defineBlock } from "../../../blocks/define";
import { compareStructure, readableAttributesByType, readableMdx } from "../skeleton";

/**
 * 사이트 블록 이름은 지금 설정에서 찾는다(블로그 예시 설정과 다른 사이트 설정 둘 다로 돈다). 설정에 그런 블록이 없으면
 * 그 경우는 건너뛴다. 정렬(`TextAlign`)·파일은 본체 블록이라 어느 설정에나 있다.
 */
const stringAttributes = (block: BlockDefinition, translatable: boolean) =>
	Object.entries(block.attributes).filter(
		([, attribute]) =>
			attribute.type === "string" && Boolean(attribute.translatable) === translatable && !attribute.childValue,
	);
/** 속성에 넣을 수 있는 값(선택 값이 있으면 `index`번째). */
const optionOf = (attribute: BlockAttribute, index: number, fallback: string) =>
	attribute.options ? (Object.keys(attribute.options)[index] ?? fallback) : fallback;

/** 번역할 속성이 있는 사이트 컨테이너(예: 콜아웃·인용 카드). 선택 값 속성이 함께 있는 블록을 먼저 고른다. */
const siteBoxes = ADDED_BLOCKS.filter(
	(block) => block.syntax.kind === "container" && !block.parent && stringAttributes(block, true).length > 0,
);
const siteBox =
	siteBoxes.find((block) => stringAttributes(block, false).some(([, attribute]) => attribute.options)) ?? siteBoxes[0];
if (!siteBox) throw new Error("skeleton test: the config has no container block with a translatable attribute");
const [titleName] = stringAttributes(siteBox, true)[0] ?? [];
/** 번역하지 않는 선택 값 속성(있으면, 예: 콜아웃 종류). */
const kind = stringAttributes(siteBox, false).find(([, attribute]) => attribute.options);
const kindProp = kind ? ` ${kind[0]}="${optionOf(kind[1], 0, "")}"` : "";
/** 번역할 속성이 있는 글자 꾸밈(예: 툴팁). */
const markBlock = ADDED_MARK_BLOCKS.find((block) => stringAttributes(block, true).length > 0);
/** 번역하지 않는 글 속성이 있는 사이트 블록(한 줄 블록 먼저, 예: 임베드 주소). */
const plainBlock = [
	...ADDED_BLOCKS.filter((block) => block.syntax.kind === "leaf"),
	...ADDED_BLOCKS.filter((block) => block.syntax.kind === "container" && !block.parent),
].find((block) => stringAttributes(block, false).some(([, attribute]) => !attribute.options));
/** 자식의 번역할 속성(예: 탭 이름)을 가리키는 속성(예: 기본 탭)이 있는 묶음과 그 자식. */
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

describe("번역 구조 검사", () => {
	it("글자와 사람이 읽는 속성만 바뀌면 통과한다", () => {
		const translated = [
			`<${Box}${kindProp} ${titleName}="Things to note">`,
			"Use `useQuery` after reading the [official docs](/posts/react-query) of **React Query**.",
			`</${Box}>`,
		].join("\n");
		// 굵게·링크의 위치가 문장 안에서 옮겨져도 된다.
		expect(compareStructure(SOURCE, translated)).toEqual({ ok: true });
	});

	it("링크 주소·인라인 코드·사람이 읽지 않는 속성이 바뀌면 실패한다", () => {
		expect(compareStructure(SOURCE, SOURCE.replace("/posts/react-query", "/posts/other")).ok).toBe(false);
		expect(compareStructure(SOURCE, SOURCE.replace("`useQuery`", "`useQueries`")).ok).toBe(false);
		const align = '<TextAlign align="center">\n가운데\n</TextAlign>';
		expect(compareStructure(align, align.replace('"center"', '"left"')).ok).toBe(false);
		if (kind) {
			const changed = SOURCE.replace(kindProp, ` ${kind[0]}="${optionOf(kind[1], 1, "other")}"`);
			expect(compareStructure(SOURCE, changed).ok).toBe(false);
		}
	});

	it("서식을 빼거나 문단을 나누면 실패한다", () => {
		expect(compareStructure(SOURCE, SOURCE.replace("**React Query**", "React Query")).ok).toBe(false);
		expect(compareStructure("첫 문단입니다.", "First paragraph.\n\nSecond paragraph.").ok).toBe(false);
	});

	it("코드 블록·이미지 주소는 그대로여야 하고, alt·캡션은 바뀌어도 된다", () => {
		const code = "```ts\nconst a = 1;\n```";
		expect(compareStructure(code, code).ok).toBe(true);
		expect(compareStructure(code, "```ts\nconst b = 1;\n```").ok).toBe(false);
		expect(compareStructure("![설정 화면](/a.png)", "![Settings screen](/a.png)").ok).toBe(true);
		expect(compareStructure("![설정 화면](/a.png)", "![Settings screen](/b.png)").ok).toBe(false);
	});

	it.skipIf(!markBlock)("툴팁 설명은 바뀌어도 된다", () => {
		if (!markBlock) return;
		const [name] = stringAttributes(markBlock, true)[0] ?? [];
		const mark = (text: string, note: string) => `:${markBlock.name}[${text}]{${name}="${note}"}`;
		expect(compareStructure(mark("가", "설명"), mark("A", "Note")).ok).toBe(true);
	});

	it("파일 이름·링크 제목은 바뀌어도 된다", () => {
		expect(compareStructure('::file{mediaId="m1" label="보고서"}', '::file{mediaId="m1" label="Report"}').ok).toBe(
			true,
		);
		expect(compareStructure('::file{mediaId="m1" label="보고서"}', '::file{mediaId="m2" label="Report"}').ok).toBe(
			false,
		);
		expect(compareStructure('[글](/a "제목")', '[Text](/a "Title")').ok).toBe(true);
	});

	it.skipIf(!labeledGroup)("탭 이름과 기본 탭은 함께 번역해도 된다", () => {
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

	it("안내 글이 남거나 MDX가 깨지면 실패한다", () => {
		expect(compareStructure("가나다", ":untranslated[가나다]").ok).toBe(false);
		expect(compareStructure("가나다", `<${Box}>열고 닫지 않음`).ok).toBe(false);
		expect(readableMdx(`<${Box}>열고 닫지 않음`).ok).toBe(false);
		expect(readableMdx("정상 문단").ok).toBe(true);
	});

	it("사이트 블록은 번역할 속성(translatable)만 바뀌어도 된다", () => {
		// 예시 설정의 콜아웃은 `title`을, 다른 사이트 설정의 인용 카드는 `author`를 번역할 속성으로 둔다.
		const box = (props: string, title: string, body: string) =>
			`:::${siteBox.name}{${[props, `${titleName}="${title}"`].filter(Boolean).join(" ")}}\n${body}\n:::`;
		const notice = box(kindProp.trim(), "공지 제목", "안내 글");
		expect(compareStructure(notice, box(kindProp.trim(), "Notice title", "Notice text"))).toEqual({ ok: true });
		if (kind) {
			const changed = `${kind[0]}="${optionOf(kind[1], 1, "other")}"`;
			expect(compareStructure(notice, box(changed, "Notice title", "Notice text")).ok).toBe(false);
		}
	});

	it.skipIf(!plainBlock)("번역할 속성이 아닌 사이트 블록 속성은 그대로여야 한다", () => {
		if (!plainBlock) return;
		// 예시 설정의 사용자 블록 `embed`의 `url`.
		const [name] = stringAttributes(plainBlock, false).find(([, attribute]) => !attribute.options) ?? [];
		const colons = plainBlock.syntax.kind === "leaf" ? "::" : ":::";
		const body = plainBlock.syntax.kind === "leaf" ? "" : "\n본문\n:::";
		const block = (url: string) => `${colons}${plainBlock.name}{${name}="${url}"}${body}`;
		expect(compareStructure(block("https://a.example"), block("https://b.example")).ok).toBe(false);
	});

	it("사람이 읽는 속성은 블록 정의에서 정한다", () => {
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
		// 번역할 자식 속성을 가리키는 속성도 함께 바뀐다(탭 이름 ↔ 처음 열 탭).
		expect([...(readable.get("Deck") ?? [])]).toEqual(["first"]);
		expect(readable.get("link")).toEqual(new Set(["title"]));
	});
});

describe("구조 검사 실패 이유", () => {
	it("이유 코드와 사전에서 만든 이유 문구를 함께 돌려준다", async () => {
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
