import type { Node as PmNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
/**
 * To keep one handle per line, narrow the pointed block down to the innermost block on that line.
 * - A list (indentation, bullet area) goes to the item at that height, and for an indented list down to the inner item.
 * - The frame and margin of a container (callout, fold, tabs, columns) go down to the inner block at that height. Only for a line
 *   with no inner block (title row, top/bottom margin) is the container itself the target.
 * - A single column or tab is not a target. For a line with no inner block, grab the outer container (column split, tabs).
 * Otherwise, when the mouse moves between the frame and the text, the handle of the same line alternates between two positions.
 */
export declare function refineBlock(block: HTMLElement, clientX: number, clientY: number): HTMLElement;
export interface TargetBlock {
    node: PmNode;
    start: number;
    end: number;
    depth: number;
    index: number;
    parent: PmNode;
}
/**
 * Finds the block-level DOM element the handle attaches to, starting from the given DOM element.
 * - Top-level block: a direct child of the editor root
 * - List item: <li> and [data-type="taskItem"]
 * - Blockquote: the whole blockquote even when pointing inside
 * - Inside a container NodeView: a direct child block of [data-node-view-content] (content hole)
 * - The container NodeView itself: when hovering the header/padding outside the contentDOM
 */
export declare function findBlockDOM(root: HTMLElement, target: HTMLElement | null): HTMLElement | null;
/**
 * Finds the move-target block that a document position points to.
 * - List item (listItem / taskItem): align depth to the listItem level and move the whole item as a unit.
 * - Block inside a blockquote / container: move by child block.
 * - Top-level block: move by depth 1 block.
 */
export declare function targetBlockAt(doc: PmNode, pos: number): TargetBlock | null;
/**
 * Computes the ProseMirror position and block info from the found block DOM element.
 */
export declare function resolveTargetBlock(view: EditorView, blockEl: HTMLElement): {
    pos: number;
    node: PmNode;
    rect: DOMRect;
} | null;
