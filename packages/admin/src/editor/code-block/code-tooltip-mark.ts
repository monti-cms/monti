import { Mark, mergeAttributes } from "@tiptap/core";

/** 코드 안 글자 툴팁의 편집기 마크 이름(코드 펜스 주석 `// @char Tooltip {content="…"}`). */
export const CODE_TOOLTIP_MARK_NAME = "codeTooltip";

/**
 * 코드 블록 안 글자 툴팁. 코드 펜스 주석 문법(본체 코드 블록 기능)이라 본문 툴팁(블록 확장 `:tooltip`)과 따로다.
 * 코드 블록 안에만 둔다(`CODE_BLOCK_MARKS`). 점선 밑줄로 보인다.
 */
export const CodeTooltipMark = Mark.create({
	name: CODE_TOOLTIP_MARK_NAME,
	addAttributes() {
		return {
			content: {
				default: "",
				parseHTML: (element) => element.getAttribute("data-code-tooltip") ?? "",
				renderHTML: (attrs) => ({ "data-code-tooltip": String(attrs.content ?? "") }),
			},
		};
	},
	parseHTML() {
		return [{ tag: "span[data-code-tooltip]" }];
	},
	renderHTML({ HTMLAttributes }) {
		return ["span", mergeAttributes(HTMLAttributes, { class: "underline decoration-dotted underline-offset-4" }), 0];
	},
});
