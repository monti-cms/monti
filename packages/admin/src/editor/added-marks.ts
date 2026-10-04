import { ADDED_MARK_BLOCKS, type BlockDefinition } from "@monti-cms/core/client";
import type { CmsJsonValue } from "@monti-cms/core/mdx";
import { Mark, mergeAttributes } from "@tiptap/core";

/**
 * 더한 글자 꾸밈(블록 확장·사이트 설정의 `syntax.kind: "text"` 블록)의 편집기 표시. 본체 편집기는 꾸밈 이름을 모르고, 블록 정의에서
 * Tiptap 마크를 만든다. 모양(클래스·스타일)과 도구(서식 도구·버블·슬래시 메뉴)는 확장이 `CmsAdminComponentsProvider`의
 * `marks`(블록 이름 → `EditorMarkExtension`)로 준다.
 *
 * - 마크 이름은 `cms` + 파스칼 블록 이름이다(`tooltip` → `cmsTooltip`, `code-ref` → `cmsCodeRef`).
 * - 속성은 정의의 속성이다. 저장 문서(CmsNode)의 mark 이름은 블록 이름이고 속성은 같다.
 * - HTML로는 `span[data-cms-mark="블록 이름"]`과 속성마다 `data-mark-<속성>`으로 그린다(붙여넣기도 이 모양을 읽는다).
 */

export type MarkAttrs = Readonly<Record<string, unknown>>;

/** 확장이 바꾸는 마크 모양. */
export interface EditorMarkSpec {
	/** 꾸밈 끝에 이어 친 글자도 꾸밈을 이어받는가. 없으면 이어받지 않는다. */
	readonly inclusive?: boolean;
	/** `span`에 더할 HTML 속성(`class`·`style`·`data-*`). 속성 값(`attrs`)을 받아 만든다. */
	readonly render?: (attrs: MarkAttrs) => Record<string, string>;
}

const pascal = (name: string) =>
	name.replace(/(^|-)([a-z0-9])/g, (_, _dash: string, char: string) => char.toUpperCase());
const kebab = (name: string) => name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

/** 더한 글자 꾸밈의 편집기 마크 이름(`cms` + 파스칼 블록 이름). */
export const addedMarkName = (blockName: string) => `cms${pascal(blockName)}`;

/** 속성 하나의 HTML 속성 이름. */
const dataAttribute = (name: string) => `data-mark-${kebab(name)}`;

/** 더한 글자 꾸밈(블록 이름 → 정의). */
export const ADDED_MARKS: ReadonlyMap<string, BlockDefinition> = new Map(
	ADDED_MARK_BLOCKS.map((block) => [block.name, block]),
);

/** 편집기 마크 이름 → 더한 글자 꾸밈 정의. */
export const ADDED_MARK_BY_EDITOR_NAME: ReadonlyMap<string, BlockDefinition> = new Map(
	ADDED_MARK_BLOCKS.map((block) => [addedMarkName(block.name), block]),
);

/**
 * 정의의 속성만 남긴 꾸밈 속성. 문자열은 값이 있을 때, 꼭 있어야 하는 속성(`required`)은 비어도(`""`) 남긴다. 불리언은 참일 때만.
 * 저장 문서(CmsNode) ↔ 편집기 마크 양쪽에 쓴다(직렬화가 같은 규칙으로 쓰므로 왕복해도 글자가 같다).
 */
export function markAttrsOf(block: BlockDefinition, attrs: MarkAttrs | null | undefined): Record<string, CmsJsonValue> {
	const out: Record<string, CmsJsonValue> = {};
	for (const [name, attribute] of Object.entries(block.attributes)) {
		const value = attrs?.[name];
		if (attribute.type === "boolean") {
			if (value === true || value === "true") out[name] = true;
			continue;
		}
		if (typeof value === "string" && value !== "") out[name] = value;
		else if (attribute.required) out[name] = typeof value === "number" ? String(value) : "";
	}
	return out;
}

/** 줄 이름표를 가리키는 속성(`codeAnchor`). */
const anchorAttribute = (block: BlockDefinition) =>
	Object.entries(block.attributes).find(([, attribute]) => attribute.codeAnchor)?.[0];

/** 더한 글자 꾸밈 하나의 Tiptap 마크. */
export function createAddedMark(block: BlockDefinition, spec: EditorMarkSpec = {}) {
	const attributes = Object.entries(block.attributes);
	const anchor = anchorAttribute(block);
	return Mark.create({
		name: addedMarkName(block.name),
		inclusive: spec.inclusive ?? false,
		addAttributes() {
			return Object.fromEntries(
				attributes.map(([name, attribute]) => [
					name,
					{
						default: null,
						parseHTML: (element: HTMLElement) => {
							const value = element.getAttribute(dataAttribute(name));
							return attribute.type === "boolean" ? value !== null || null : value;
						},
						// 속성마다 따로 그리지 않고 아래 `renderHTML`에서 한꺼번에 그린다.
						renderHTML: () => ({}),
					},
				]),
			);
		},
		parseHTML() {
			return [{ tag: `span[data-cms-mark="${block.name}"]` }];
		},
		renderHTML({ mark, HTMLAttributes }) {
			const attrs = mark.attrs as MarkAttrs;
			const data = Object.fromEntries(
				Object.entries(markAttrsOf(block, attrs)).map(([name, value]) => [
					dataAttribute(name),
					value === true ? "" : String(value),
				]),
			);
			const anchorValue = anchor ? attrs[anchor] : undefined;
			return [
				"span",
				mergeAttributes(
					HTMLAttributes,
					{ "data-cms-mark": block.name, ...data },
					// 코드 줄 이름표를 가리키면 편집기 코드 블록이 마우스를 올린 줄을 강조한다(`data-code-ref`).
					typeof anchorValue === "string" && anchorValue ? { "data-code-ref": anchorValue } : {},
					spec.render?.(attrs) ?? {},
				),
				0,
			];
		},
	});
}

/** 본문 글자와 코드 줄을 잇는 꾸밈(속성에 `codeAnchor`가 있는 블록). 없으면 코드 블록의 잇기 도구가 숨는다. */
export const CODE_ANCHOR_REF: { readonly mark: string; readonly attribute: string } | null = (() => {
	for (const block of ADDED_MARK_BLOCKS) {
		const attribute = anchorAttribute(block);
		if (attribute) return { mark: addedMarkName(block.name), attribute };
	}
	return null;
})();
