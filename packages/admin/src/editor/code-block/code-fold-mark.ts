import { Mark, mergeAttributes } from "@tiptap/core";

/**
 * 코드 안 글자 접기(`// @char fold {…}`). 공개 화면에서는 `…`로 접혀 있다가 누르면 펼친다.
 * 에디터에서도 접어 보이고(effects-plugin), 커서가 들어가거나 `…`을 누르면 펼친다.
 * 뒤에 이어 친 글자까지 접히지 않게 `inclusive`를 끈다.
 */
export const CodeFoldMark = Mark.create({
	name: "codeFold",
	inclusive: false,
	addAttributes() {
		return {
			/** 공개 화면에서 처음부터 펼쳐 둘지(`open`). */
			open: {
				default: false,
				parseHTML: (element) => element.getAttribute("data-open") === "true",
				renderHTML: (attrs) => (attrs.open ? { "data-open": "true" } : {}),
			},
		};
	},
	parseHTML() {
		return [{ tag: "span[data-code-fold]" }];
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"span",
			mergeAttributes(HTMLAttributes, {
				"data-code-fold": "",
				class: "rounded-sm outline-1 outline-cms-muted-foreground/50 outline-dashed -outline-offset-1",
			}),
			0,
		];
	},
});
