import { Mark } from "@tiptap/core";
/** Editor mark name of the tooltip on text inside code (code fence comment `// @char Tooltip {content="..."}`). */
export declare const CODE_TOOLTIP_MARK_NAME = "codeTooltip";
/**
 * Tooltip on text inside a code block. It is the code fence comment syntax (a core code block feature), so it is separate from the body tooltip (block extension `:tooltip`).
 * Placed only inside code blocks (`CODE_BLOCK_MARKS`). Shown with a dotted underline.
 */
export declare const CodeTooltipMark: Mark<any, any>;
