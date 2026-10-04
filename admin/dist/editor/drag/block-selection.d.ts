import { type EditorState, Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { type EditorView } from "@tiptap/pm/view";
/**
 * Block selection (like Notion block selection). Kept separate from text selection: dragging over text selects only text, while
 * dragging a box (marquee) from the margin outside the body selects whole lines (blocks). What is visible and what gets deleted must match.
 *
 * State is the start positions of the selected lines (document order). A line is a top-level block, and in lists every item is its own line
 * (indented items can also be picked separately). Selecting a parent item brings its child items along.
 * Selected lines are painted whole, and dragging the handle of any one of them moves them all together (startBlockDrag).
 * So that copy works, the ProseMirror selection is also set to a text selection from the first to the last line, but the text selection highlight is hidden.
 */
export declare const cmsBlockSelectionKey: PluginKey<number[] | null>;
/** Classes put on the editor while a block selection is active and on the selected lines (styles live in the editor class). */
export declare const BLOCK_RANGE_CLASS = "cms-block-range";
export declare const BLOCK_SELECTED_CLASS = "cms-block-selected";
export declare const selectedBlocks: (state: EditorState) => number[] | null;
/** Selects lines. So that copy works, the ProseMirror selection is also set to the text from the first to the last line. */
export declare function setBlockSelection(tr: Transaction, positions: readonly number[] | null): Transaction;
/** Deletes the selected lines whole. If all list items go, the list goes too; where the slot cannot be empty, an empty paragraph is left. */
export declare function deleteSelectedBlocks(state: EditorState): Transaction | null;
/** Whether x is outside the left or right of the body column (the editor minus its inner padding). Marquee selection starts only here. */
export declare function isOutsideContentColumn(view: EditorView, clientX: number): boolean;
export declare function createBlockSelectionPlugin(): Plugin<number[] | null>;
/**
 * Starts a marquee (box) selection. Pressing and dragging in the margin outside the body draws a box and selects the lines
 * that overlap the box's vertical range (continuously from the first to the last line, without skipping lines between). Scrolls when it reaches the top or bottom of the screen.
 * A small movement then release (a click) does nothing.
 */
export declare function startMarquee(view: EditorView, event: MouseEvent): void;
