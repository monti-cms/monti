import { Mark, mergeAttributes } from "@tiptap/core";

/**
 * Folding text inside code (`// @char fold {…}`). On the public page it is folded as `…` and unfolds when clicked.
 * The editor also shows it folded (effects-plugin), and unfolds when the cursor enters or `…` is clicked.
 * `inclusive` is turned off so text typed after it does not get folded.
 */
export const CodeFoldMark = Mark.create({
	name: "codeFold",
	inclusive: false,
	addAttributes() {
		return {
			/** Whether to start unfolded on the public page (`open`). */
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
