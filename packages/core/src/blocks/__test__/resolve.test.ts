import { describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata } from "../../../test/any-site";
import { ADDED_BLOCKS } from "../active";
import { type BlockDefinition, defineBlock } from "../define";
import { BUILTIN_BLOCKS } from "../definitions";
import { resolveBlocks } from "../resolve";

const card = defineBlock({
	name: "card",
	label: "카드",
	syntax: { kind: "container", directive: "card" },
	component: "Card",
	attributes: {},
	editor: { view: "node", insertable: true },
});

const names = (blocks: readonly { name: string }[]) => blocks.map((block) => block.name);

const diagram = defineBlock({
	name: "diagram",
	label: "다이어그램",
	syntax: { kind: "fence", lang: "diagram" },
	component: "Diagram",
	attributes: {},
	editor: { view: "node", insertable: true },
});

describe("사이트 설정의 본문 블록", () => {
	it("설정이 없으면 본체 블록만 쓴다", () => {
		expect(names(resolveBlocks(undefined))).toEqual(names(BUILTIN_BLOCKS));
		expect(names(BUILTIN_BLOCKS)).not.toContain("callout");
	});

	it("플러그인 블록 다음에 사이트 블록을 더한다", () => {
		const blocks = names(
			resolveBlocks({ plugins: [{ name: "diagram", blocks: [diagram] }, { name: "ai" }], blocks: [card] }),
		);
		expect(blocks.slice(-2)).toEqual(["diagram", "card"]);
		expect(blocks.slice(0, BUILTIN_BLOCKS.length)).toEqual(names(BUILTIN_BLOCKS));
	});

	it("더한 블록의 이름·문법·컴포넌트·편집 방식·자식을 검사한다", () => {
		const bad = (patch: object) => resolveBlocks({ blocks: [{ ...card, ...patch } as never] });
		expect(() => bad({ name: "Card" })).toThrow(/kebab/);
		expect(() => bad({ syntax: { kind: "math" } })).toThrow(/container, leaf, text or fence/);
		// 글자 꾸밈(`text`)은 `mark` 편집 방식이고 자식이 없다.
		expect(() => bad({ syntax: { kind: "text", directive: "card" } })).toThrow(/text block needs editor.view "mark"/);
		expect(() => bad({ syntax: { kind: "container", directive: "other" } })).toThrow(/directive must equal/);
		expect(() => bad({ component: "card" })).toThrow(/PascalCase/);
		expect(() => bad({ name: "image", syntax: { kind: "leaf", directive: "image" } })).toThrow(/already used/);
		expect(() => bad({ component: "Image" })).toThrow(/already used/);
		expect(() => bad({ editor: { view: "mark" } })).toThrow(/editor.view/);
		expect(() => bad({ children: { blocks: ["tab"] } })).toThrow(/added block with this parent/);
		expect(() => resolveBlocks({ blocks: [card, card] })).toThrow(/already used/);
	});

	it("글자 꾸밈(`text`·`mark`)을 더하고, 코드 줄 이름표 속성(`codeAnchor`)은 꾸밈 하나의 글 속성 하나다", () => {
		const note = defineBlock({
			name: "note",
			label: "메모",
			syntax: { kind: "text", directive: "note" },
			component: "Note",
			attributes: { text: { type: "string", label: "글", required: true } },
			editor: { view: "mark" },
		});
		expect(resolveBlocks({ blocks: [note] }).at(-1)).toBe(note);
		expect(() => resolveBlocks({ blocks: [{ ...note, children: { min: 0 } }] })).toThrow(/no children or parent/);
		const anchor = { ...note, attributes: { to: { type: "string" as const, label: "줄", codeAnchor: true } } };
		expect(resolveBlocks({ blocks: [anchor] }).at(-1)).toBe(anchor);
		expect(() =>
			resolveBlocks({
				blocks: [
					anchor,
					{ ...anchor, name: "note-two", component: "NoteTwo", syntax: { kind: "text", directive: "note-two" } },
				],
			}),
		).toThrow(/only one block can link code lines/);
		expect(() => resolveBlocks({ blocks: [{ ...card, attributes: { to: anchor.attributes.to } }] })).toThrow(
			/codeAnchor/,
		);
	});

	it("코드 펜스 블록은 언어가 겹치지 않는다", () => {
		expect(() =>
			resolveBlocks({ blocks: [diagram, { ...diagram, name: "diagram-two", component: "DiagramTwo" }] }),
		).toThrow(/fence lang "diagram" is already used/);
		expect(() => resolveBlocks({ blocks: [{ ...diagram, syntax: { kind: "fence", lang: "Diagram" } }] })).toThrow(
			/lower-case/,
		);
	});

	it("자식 값 속성은 자식 블록에 그 속성이 있어야 한다", () => {
		const group = defineBlock({
			name: "group",
			label: "묶음",
			syntax: { kind: "container", directive: "group" },
			component: "Group",
			attributes: { first: { type: "string", label: "처음", childValue: "label" } },
			children: { blocks: ["item"] },
			editor: { view: "node" },
		});
		const item = defineBlock({
			name: "item",
			label: "항목",
			syntax: { kind: "container", directive: "item" },
			component: "Item",
			attributes: {},
			parent: "group",
			editor: { view: "node" },
		});
		expect(() => resolveBlocks({ blocks: [group, item] })).toThrow(/no child block has "label"/);
		const labeled = { ...item, attributes: { label: { type: "string" as const, label: "이름" } } };
		expect(names(resolveBlocks({ blocks: [group, labeled] })).slice(-2)).toEqual(["group", "item"]);
	});
});

describe("사용자 블록 발행 검사", () => {
	// 블록은 지금 설정에서 찾는다(블로그 예시 설정은 콜아웃 종류·사용자 블록 `embed` 주소). 그런 블록이 없는 설정이면 건너뛴다.
	const attributeOf = (block: BlockDefinition, pick: (attribute: BlockDefinition["attributes"][string]) => boolean) =>
		Object.entries(block.attributes).find(([, attribute]) => attribute.type === "string" && pick(attribute));
	const nonText = ADDED_BLOCKS.filter(
		(block) => (block.syntax.kind === "leaf" || block.syntax.kind === "container") && !block.parent,
	);
	/** 선택 값 속성이 있는 블록. */
	const choiceBlock = nonText.find((block) => attributeOf(block, (attribute) => Boolean(attribute.options)));
	/** 필수 속성이 있는 블록(한 줄 블록 먼저). */
	const requiredBlock = [...nonText]
		.sort((a, b) => Number(b.syntax.kind === "leaf") - Number(a.syntax.kind === "leaf"))
		.find((block) => attributeOf(block, (attribute) => Boolean(attribute.required) && !attribute.options));

	/** 지시자 블록 한 개의 원문(속성 문자열을 받는다). */
	const directive = (block: BlockDefinition, props: string) =>
		block.syntax.kind === "leaf" ? `::${block.name}${props}\n` : `:::${block.name}${props}\n본문\n:::\n`;

	const issuesOf = async (mdx: string) => {
		const { prepareSnapshot } = await import("../../core/snapshot");
		const snapshot = await prepareSnapshot({
			collection: contentCollection,
			slug: "custom-blocks",
			// 발행 필수 메타데이터는 채워 블록 검사만 본다(관계는 형식만 맞는 ID).
			metadata: await requiredMetadata(
				contentCollection,
				"사용자 블록",
				async () => "00000000-0000-4000-8000-000000000000",
			),
			mdx,
		});
		return snapshot.issues.map((issue) => issue.code);
	};

	it.skipIf(!choiceBlock)("선택 값 밖의 속성을 막는다", async () => {
		if (!choiceBlock) return;
		const [name, attribute] = attributeOf(choiceBlock, (candidate) => Boolean(candidate.options)) ?? [];
		const valid = Object.keys(attribute?.options ?? {})[0];
		expect(await issuesOf(directive(choiceBlock, `{${name}="not-an-option"}`))).toContain("invalid_block_attribute");
		expect(await issuesOf(directive(choiceBlock, `{${name}="${valid}"}`))).toEqual([]);
	});

	it.skipIf(!requiredBlock)("빠진 필수 속성을 막는다", async () => {
		if (!requiredBlock) return;
		const [name] = attributeOf(requiredBlock, (attribute) => Boolean(attribute.required) && !attribute.options) ?? [];
		expect(await issuesOf(directive(requiredBlock, ""))).toContain("missing_block_attribute");
		expect(await issuesOf(directive(requiredBlock, `{${name}="https://example.com"}`))).toEqual([]);
	});
});
