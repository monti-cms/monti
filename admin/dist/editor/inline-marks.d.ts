import type { Site } from "@monti-cms/core/client";
import { type CodeRule } from "@monti-cms/core/code-block";
import type { Editor } from "@tiptap/core";
import { type EditorState } from "@tiptap/pm/state";
import type { ToolbarItem } from "./toolbar-button.js";
/** Names of the marks of the inline tools, in the order the tools are shown. */
export declare const INLINE_MARK_NAMES: readonly ["bold", "italic", "underline", "strike", "code", "superscript", "subscript"];
export interface InlineMarkTool extends ToolbarItem {
    /** Name of the mark this tool toggles. */
    mark: string;
}
/**
 * Whether the editor offers the tool for this mark at the selection. The marks the body's allowed list does not allow are hidden, and so are the code block
 * tools that the site turned off (`codeBlock.features`), only inside code. A mark already on the selection stays offered so it can be removed.
 */
export declare const offersMarkTool: (site: Site, state: EditorState, mark: string) => boolean;
/** The inline tools of a site (their text follows the site's admin language, and which of them work in code follows `codeBlock.features`). */
export declare const inlineMarkTools: (site: Site) => InlineMarkTool[];
/** Inline tools available on the text block containing the selection. A code block only gets bold, italic, strikethrough and underline (when the site offers them). */
export declare const allowedMarkTools: (site: Site, state: EditorState) => InlineMarkTool[];
export declare const allowsMark: (state: EditorState, mark: string) => boolean;
/**
 * Order of marks shown in the bubble when the cursor is placed. Marks with settings (links, extension text styles, in-code tooltips and text folds) come first.
 * `detailed` is a mark whose content a text-style extension draws (`EditorMarkExtension.detail`).
 */
export declare const bubbleMarkOrder: (detailed?: readonly string[]) => string[];
/** Marks with settings that attach the bubble to a range (links, in-code tooltips). Content of extension text styles is the same. */
export declare const RANGED_MARKS: readonly string[];
/** One mark the cursor touches and the range it spans. */
export interface ActiveInlineMark {
    name: string;
    from: number;
    to: number;
    attrs: Record<string, unknown>;
}
/** One match of a regex rule the cursor touches (code block). Being a rule, this single match cannot be removed on its own. */
export interface ActiveCodeRule {
    rule: CodeRule;
    blockPos: number;
    from: number;
    to: number;
    count: number;
}
export type InlineBubbleTarget = {
    kind: "selection";
    from: number;
    to: number;
} | {
    kind: "marks";
    pos: number;
    marks: ActiveInlineMark[];
    rules: ActiveCodeRule[];
};
/**
 * Target for showing the inline bubble.
 * - When text is selected (`selection`), shows the tools that apply effects.
 * - When the cursor is inside or at the end of an effect (`marks`), returns the touched effects and their ranges (for removing and editing settings).
 * Not shown for block (marquee) selection, cell selection, node selection, selection spanning code blocks, or a code block in raw-source editing.
 */
export declare function inlineBubbleTarget(state: EditorState, detailed?: readonly string[]): InlineBubbleTarget | null;
/** Removes one effect over its whole range. The cursor stays in place. */
export declare function removeInlineMark(editor: Editor, mark: ActiveInlineMark): boolean;
