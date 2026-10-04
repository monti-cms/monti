import { Mark, mergeAttributes } from "@tiptap/core";
/** Editor mark name of the tooltip on text inside code (code fence comment `// @char Tooltip {content="..."}`). */
export const CODE_TOOLTIP_MARK_NAME = "codeTooltip";
/**
 * Tooltip on text inside a code block. It is the code fence comment syntax (a core code block feature), so it is separate from the body tooltip (block extension `:tooltip`).
 * Placed only inside code blocks (`CODE_BLOCK_MARKS`). Shown with a dotted underline.
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
