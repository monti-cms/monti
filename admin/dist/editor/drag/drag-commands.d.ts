import { Fragment, type Node as PmNode, Slice } from "@tiptap/pm/model";
import { type EditorState, Selection, type Transaction } from "@tiptap/pm/state";
/**
 * Pure block drag-and-drop command functions.
 * ProseMirror transactions and schema validation can run in jsdom/unit tests without DOM dependencies.
 */
/** Transaction meta announcing the positions (number[]) of moved blocks after moving several blocks (block selection continues). */
export declare const MOVED_BLOCKS_META = "cmsMovedBlocks";
/** CMS containers that must keep at least one body block (built from block definitions). Moving the only block leaves an empty paragraph. */
/** Range to delete when taking blocks out. If `fill` is set, that spot is filled with it. null if they cannot be taken out. */
export interface SourceRange {
    from: number;
    to: number;
    fill?: PmNode;
}
/**
 * Decides the range to delete so the spot left by the removed block(s) still satisfies the schema.
 * - If the parent stays valid without the block, delete only the block.
 * - If it is every item of a list (the only item, one indented item, etc.), delete the whole list so no empty list remains.
 * - If it is every block of a container (callout, fold, tab, column), leave an empty paragraph.
 * - Otherwise (e.g. the only paragraph in a list item), do not take it out, to keep empty blocks from filling themselves.
 */
export declare function sourceRangeOf(doc: PmNode, fromPos: number, toPos?: number): SourceRange | null;
/**
 * Verifies that the target position (targetPos) allows the block (fromPos, ~toPos for a group) per the schema.
 * - Drops inside the range to take out (sourceRangeOf) or on its boundary (no-op) are rejected.
 * - Positions the schema does not allow are rejected via canReplace / contentMatch checks.
 */
export declare function canDropBlockNode(doc: PmNode, fromPos: number, targetPos: number, toPos?: number): boolean;
/**
 * The content actually inserted when placing the block at fromPos (~toPos for a group) at targetPos. null if it cannot be placed.
 * - Drops inside the range to take out (sourceRangeOf) or on its boundary (no-op) are rejected.
 * - A list item placed outside a list (between paragraphs, inside a container) is wrapped in its original list type (items
 *   can be dragged out of a list, like Notion). An item with child items moves along with its children.
 */
export declare function placeableContentAt(doc: PmNode, fromPos: number, targetPos: number, toPos?: number): {
    content: Fragment;
    wrapped: PmNode | null;
} | null;
/**
 * Computes a valid schema drop position from mouse coordinates/position.
 * - When dropped inside a text block, uses dropPoint to find a valid position at the parent boundary before/after.
 * - Returns null when the schema does not allow it, so the drop is ignored.
 */
export declare function calculateDropPosition(doc: PmNode, fromPos: number, rawTargetPos: number, slice?: Slice, toPos?: number): number | null;
/** Returns a selection suited to the moved node (NodeSelection for atom nodes, TextSelection/Selection for regular blocks). */
export declare function selectionForMovedNode(doc: PmNode, pos: number, node: PmNode): Selection | null;
/**
 * Moves a block (adjacent blocks fromPos~toPos for a group) to targetPos in a single transaction ("one drag = one undo").
 * Returns null and does nothing if the schema does not allow it.
 * Moving one block selects it; moving several announces the moved spots via MOVED_BLOCKS_META (block selection continues).
 */
export declare function moveBlockNode(state: EditorState, fromPos: number, targetPos: number, toPos?: number): Transaction | null;
/** Content to insert when placing the group at targetPos. null if inside the group or the schema does not allow it. */
export declare function placeableBlockSetAt(doc: PmNode, positions: readonly number[], targetPos: number): Fragment | null;
/** Valid positions to place the group (used for the indicator while dragging and for the drop). */
export declare function calculateBlockSetDropPosition(doc: PmNode, positions: readonly number[], rawTargetPos: number): number | null;
/**
 * Deletes lines from the group (from the back). If all items of a list are removed, delete the whole list; if a container becomes empty, leave an empty paragraph.
 * If the whole document becomes empty, leave one empty paragraph.
 */
export declare function deleteBlockSet(tr: Transaction, positions: readonly number[]): Transaction;
/**
 * Moves a block group to targetPos (one undo step). Announces the new positions of the moved lines via MOVED_BLOCKS_META.
 * Same-type lists on both sides of the insertion and between the inserted content are merged.
 */
export declare function moveBlockSet(state: EditorState, positions: readonly number[], targetPos: number): Transaction | null;
