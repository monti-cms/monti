import { type CodeLineEffect, type CodeRule } from "@monti-cms/core/code-block";
import type { Node as PmNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { type EditorView } from "@tiptap/pm/view";
/**
 * Shows a code block's line effects, regex rules and folding in the editor.
 *
 * - Warning and error lines get a wavy underline; text matched by a rule is painted in that effect's style (plus a faint background).
 * - Line folds and text folds actually collapse, as on the public page. The initial state follows the `open` attribute; the state toggled while editing
 *   lives only in this plugin's state (`overrides`) and is not saved. A fold opens by itself when the cursor enters it.
 * - When text is edited, line numbers of line effects and line rules move along with the text (appendTransaction).
 * Line backgrounds (highlight, add, remove) and the line number gutter are drawn by the NodeView (code-block-view.tsx).
 */
export interface CodeEffectsState {
    /** Fold open state. `c:<line effect id>`, `m:<document position>` (text folds and rule folds). */
    overrides: Map<string, boolean>;
    /** Lines picked in the line number gutter (code block position, [start, end) lines). Cleared when the selection changes by other means. */
    picked: LinePick | null;
    /** While linking text to code, the side picked first (body text or a code line). Picking and confirming the other side links them. */
    linking: LinkDraft | null;
    /** Line name of the body link (`data-code-ref`, `CODE_ANCHOR_REF`) under the mouse. That line is highlighted and the rest are dimmed. */
    hoverRef: string | null;
    version: number;
}
export type LinkDraft = {
    kind: "text";
    from: number;
    to: number;
} | {
    kind: "lines";
    blockPos: number;
    start: number;
    end: number;
};
export interface LinePick {
    blockPos: number;
    start: number;
    end: number;
}
type EffectsMeta = {
    key: string;
    open: boolean;
} | {
    pick: LinePick | null;
} | {
    linking: LinkDraft | null;
} | {
    hoverRef: string | null;
};
/** Transaction meta that changes the plugin state (used by the link commands). */
export declare const effectsMeta: (meta: EffectsMeta) => EffectsMeta;
export declare const codeEffectsKey: PluginKey<CodeEffectsState>;
export interface FoldRegion {
    key: string;
    kind: "collapse" | "fold";
    /** Document range [from, to) to hide. A line fold runs from the end of the first line to the end of the last line (the first line stays visible). */
    from: number;
    to: number;
    open: boolean;
    defaultOpen: boolean;
    /** Number of lines hidden by a line fold. */
    hiddenLines: number;
    startLine?: number;
    endLine?: number;
}
export declare const lineEffectsOf: (node: PmNode) => CodeLineEffect[];
export declare const rulesOf: (node: PmNode) => CodeRule[];
/** Fold ranges of the code block (document position `pos`). */
export declare function foldRegions(node: PmNode, pos: number, overrides: ReadonlyMap<string, boolean>): FoldRegion[];
/** Ranges that are shown folded (not inside another folded range). */
export declare function visibleClosedRegions(regions: readonly FoldRegion[]): FoldRegion[];
/**
 * Marks lines `start` to `end` of the code block (`blockPos`) as picked in the line number gutter.
 * Text is not selected (it is not painted like a drag selection). Only the cursor is placed before the first line; the picked lines are shown by the line background.
 */
export declare function pickLines(view: EditorView, blockPos: number, start: number, end: number): void;
/** Removes a rule (its effect disappears everywhere it matched). */
export declare function removeRule(view: EditorView, blockPos: number, ruleId: string): void;
/** Removes a rule and leaves the same effect as a text mark at every place it currently matches (so each can be removed one by one). */
export declare function expandRule(view: EditorView, blockPos: number, ruleId: string): void;
/** Toggles a fold. When folding, if the cursor would be hidden, it moves to before the fold. */
export declare function setFoldOpen(view: EditorView, region: FoldRegion, open: boolean): void;
/** Line labels of every code line in the document (ids of `anchor` line effects). */
export declare function anchorIds(doc: PmNode): Set<string>;
export declare function createCodeEffectsPlugin(): Plugin<CodeEffectsState>;
export {};
