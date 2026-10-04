import { Fragment, Slice } from "@tiptap/pm/model";
import { NodeSelection, Selection, TextSelection } from "@tiptap/pm/state";
import { canJoin, dropPoint } from "@tiptap/pm/transform";
import { BODY_CONTAINER_NODE_NAMES } from "../blocks/added/shared.js";
/**
 * Pure block drag-and-drop command functions.
 * ProseMirror transactions and schema validation can run in jsdom/unit tests without DOM dependencies.
 */
/** Transaction meta announcing the positions (number[]) of moved blocks after moving several blocks (block selection continues). */
export const MOVED_BLOCKS_META = "cmsMovedBlocks";
/** Lists that must not be empty. Moving the only item removes the whole empty list. */
const LIST_NODES = new Set(["bulletList", "orderedList", "taskList"]);
/** CMS containers that must keep at least one body block (built from block definitions). Moving the only block leaves an empty paragraph. */
const CONTAINER_BODY_NODES = BODY_CONTAINER_NODE_NAMES;
/**
 * Group of blocks to move: adjacent blocks in the same parent (before `from` to after `to`). Omit `to` for a single block.
 * null if they are not block boundaries of the same parent.
 */
const blockRangeAt = (doc, fromPos, toPos) => {
    if (fromPos < 0 || fromPos >= doc.content.size)
        return null;
    const node = doc.nodeAt(fromPos);
    if (!node)
        return null;
    const to = toPos ?? fromPos + node.nodeSize;
    if (to <= fromPos || to > doc.content.size)
        return null;
    const $from = doc.resolve(fromPos);
    const $to = doc.resolve(to);
    if ($from.depth !== $to.depth || !$from.sameParent($to))
        return null;
    return { from: fromPos, to, $from, start: $from.index(), end: $to.index(), content: doc.slice(fromPos, to).content };
};
/**
 * Decides the range to delete so the spot left by the removed block(s) still satisfies the schema.
 * - If the parent stays valid without the block, delete only the block.
 * - If it is every item of a list (the only item, one indented item, etc.), delete the whole list so no empty list remains.
 * - If it is every block of a container (callout, fold, tab, column), leave an empty paragraph.
 * - Otherwise (e.g. the only paragraph in a list item), do not take it out, to keep empty blocks from filling themselves.
 */
export function sourceRangeOf(doc, fromPos, toPos) {
    const range = blockRangeAt(doc, fromPos, toPos);
    if (!range)
        return null;
    const { $from, start, end } = range;
    const parent = $from.parent;
    if (parent.canReplace(start, end))
        return { from: range.from, to: range.to };
    const takesAll = start === 0 && end === parent.childCount;
    if (LIST_NODES.has(parent.type.name) && takesAll && $from.depth > 0) {
        const depth = $from.depth;
        const grand = $from.node(depth - 1);
        const index = $from.index(depth - 1);
        if (grand.canReplace(index, index + 1))
            return { from: $from.before(depth), to: $from.after(depth) };
    }
    const paragraph = doc.type.schema.nodes.paragraph;
    if (CONTAINER_BODY_NODES.has(parent.type.name) && paragraph) {
        const fill = paragraph.create();
        if (parent.canReplaceWith(start, end, fill.type))
            return { from: range.from, to: range.to, fill };
    }
    return null;
}
/**
 * Verifies that the target position (targetPos) allows the block (fromPos, ~toPos for a group) per the schema.
 * - Drops inside the range to take out (sourceRangeOf) or on its boundary (no-op) are rejected.
 * - Positions the schema does not allow are rejected via canReplace / contentMatch checks.
 */
export function canDropBlockNode(doc, fromPos, targetPos, toPos) {
    return placeableContentAt(doc, fromPos, targetPos, toPos) !== null;
}
/** List item. Placed outside a list, it is wrapped in its original list type. */
const LIST_ITEM_NODES = new Set(["listItem", "taskItem"]);
/** List wrapping the item(s) in their original list type (bullet, ordered, task). null if not an item or it cannot be wrapped. */
const wrapInSourceList = (doc, fromPos, items) => {
    let allItems = items.childCount > 0;
    items.forEach((item) => {
        if (!LIST_ITEM_NODES.has(item.type.name))
            allItems = false;
    });
    if (!allItems)
        return null;
    const list = doc.resolve(fromPos).parent;
    if (!LIST_NODES.has(list.type.name))
        return null;
    const { order: _order, ...attrs } = list.attrs;
    return list.type.validContent(items) ? list.type.create(attrs, items) : null;
};
/**
 * The content actually inserted when placing the block at fromPos (~toPos for a group) at targetPos. null if it cannot be placed.
 * - Drops inside the range to take out (sourceRangeOf) or on its boundary (no-op) are rejected.
 * - A list item placed outside a list (between paragraphs, inside a container) is wrapped in its original list type (items
 *   can be dragged out of a list, like Notion). An item with child items moves along with its children.
 */
export function placeableContentAt(doc, fromPos, targetPos, toPos) {
    const range = blockRangeAt(doc, fromPos, toPos);
    const source = sourceRangeOf(doc, fromPos, toPos);
    if (!range || !source)
        return null;
    if (targetPos >= source.from && targetPos <= source.to)
        return null;
    if (targetPos < 0 || targetPos > doc.content.size)
        return null;
    const $target = doc.resolve(targetPos);
    const index = $target.index();
    if ($target.parent.canReplace(index, index, range.content))
        return { content: range.content, wrapped: null };
    const wrapped = wrapInSourceList(doc, fromPos, range.content);
    return wrapped && $target.parent.canReplaceWith(index, index, wrapped.type)
        ? { content: Fragment.from(wrapped), wrapped }
        : null;
}
/**
 * Computes a valid schema drop position from mouse coordinates/position.
 * - When dropped inside a text block, uses dropPoint to find a valid position at the parent boundary before/after.
 * - Returns null when the schema does not allow it, so the drop is ignored.
 */
export function calculateDropPosition(doc, fromPos, rawTargetPos, slice, toPos) {
    const range = blockRangeAt(doc, fromPos, toPos);
    if (!range)
        return null;
    const contentSlice = slice ?? new Slice(range.content, 0, 0);
    // Try to compute a valid insertion point for the schema via ProseMirror's dropPoint.
    // A list item has no place to go outside a list, so look once more with the shape wrapped in a list.
    let point = dropPoint(doc, rawTargetPos, contentSlice);
    const wrapped = point === null ? wrapInSourceList(doc, fromPos, range.content) : null;
    if (wrapped)
        point = dropPoint(doc, rawTargetPos, new Slice(Fragment.from(wrapped), 0, 0));
    if (point === null) {
        // If dropped at an exact position between blocks, check canDropBlockNode directly
        if (canDropBlockNode(doc, fromPos, rawTargetPos, toPos)) {
            point = rawTargetPos;
        }
        else {
            return null;
        }
    }
    // Re-verify that the final computed position satisfies canDropBlockNode
    if (!canDropBlockNode(doc, fromPos, point, toPos)) {
        return null;
    }
    return point;
}
/** Returns a selection suited to the moved node (NodeSelection for atom nodes, TextSelection/Selection for regular blocks). */
export function selectionForMovedNode(doc, pos, node) {
    try {
        if (NodeSelection.isSelectable(node)) {
            return NodeSelection.create(doc, pos);
        }
    }
    catch {
        // If a node selection is not possible, fall back to a text cursor selection
    }
    try {
        return TextSelection.near(doc.resolve(Math.min(pos + 1, doc.content.size)));
    }
    catch {
        return Selection.near(doc.resolve(pos));
    }
}
/**
 * Moves a block (adjacent blocks fromPos~toPos for a group) to targetPos in a single transaction ("one drag = one undo").
 * Returns null and does nothing if the schema does not allow it.
 * Moving one block selects it; moving several announces the moved spots via MOVED_BLOCKS_META (block selection continues).
 */
export function moveBlockNode(state, fromPos, targetPos, toPos) {
    const { doc } = state;
    const range = blockRangeAt(doc, fromPos, toPos);
    const source = sourceRangeOf(doc, fromPos, toPos);
    const placed = placeableContentAt(doc, fromPos, targetPos, toPos);
    if (!range || !source || !placed) {
        return null;
    }
    const tr = state.tr;
    // Handle deletion and insertion in a single transaction to guarantee a single Undo step
    if (source.fill)
        tr.replaceWith(source.from, source.to, source.fill);
    else
        tr.delete(source.from, source.to);
    const insertedAt = tr.mapping.map(targetPos);
    tr.insert(insertedAt, placed.content);
    // Spots of the moved blocks. If wrapped in a list, it is inside that list (the items).
    let movedStart = placed.wrapped ? insertedAt + 1 : insertedAt;
    let movedEnd = movedStart + range.content.size;
    // If wrapped in a list and the adjacent list is of the same type, merge them. Merge the later one first (merging the earlier one shifts positions by 2).
    // Lists of different types (bullet <-> ordered) are not merged. canJoin allows it for the same items even if the types differ.
    const { wrapped } = placed;
    if (wrapped) {
        const sameList = (pos, side) => {
            const $pos = tr.doc.resolve(pos);
            const neighbor = side === "before" ? $pos.nodeBefore : $pos.nodeAfter;
            return neighbor?.type === wrapped.type && canJoin(tr.doc, pos);
        };
        const after = insertedAt + wrapped.nodeSize;
        if (sameList(after, "after"))
            tr.join(after);
        if (sameList(insertedAt, "before")) {
            tr.join(insertedAt);
            movedStart -= 2;
            movedEnd -= 2;
        }
    }
    const first = range.content.firstChild;
    const selection = range.content.childCount === 1 && first
        ? selectionForMovedNode(tr.doc, movedStart, first)
        : TextSelection.between(tr.doc.resolve(movedStart + 1), tr.doc.resolve(movedEnd - 1));
    if (selection) {
        tr.setSelection(selection);
    }
    if (range.content.childCount > 1) {
        const moved = [];
        let offset = movedStart;
        range.content.forEach((child) => {
            moved.push(offset);
            offset += child.nodeSize;
        });
        tr.setMeta(MOVED_BLOCKS_META, moved);
    }
    tr.scrollIntoView();
    return tr;
}
/**
 * Turns a block group (lines from different parents can be mixed: a heading plus some list items, etc.) into a shape to insert in one place.
 * - Items continuing in the same list are wrapped in that list type (when placed outside a list).
 * - If all are list items, also returns the items as they are, for placing between lists.
 */
function blockSetContent(doc, positions) {
    const groups = [];
    const items = [];
    let itemsOnly = positions.length > 0;
    for (const pos of positions) {
        const node = doc.nodeAt(pos);
        if (!node)
            return null;
        const parent = doc.resolve(pos).parent;
        const isItem = LIST_ITEM_NODES.has(node.type.name) && LIST_NODES.has(parent.type.name);
        if (isItem)
            items.push(node);
        else
            itemsOnly = false;
        const last = groups[groups.length - 1];
        if (isItem && last?.list === parent)
            last.nodes.push(node);
        else
            groups.push({ list: isItem ? parent : null, nodes: [node] });
    }
    const blocks = groups.map(({ list, nodes }) => {
        if (!list)
            return nodes[0];
        const { order: _order, ...attrs } = list.attrs;
        return list.type.create(attrs, nodes);
    });
    return { blocks: Fragment.fromArray(blocks), items: itemsOnly ? Fragment.fromArray(items) : null };
}
/** Content to insert when placing the group at targetPos. null if inside the group or the schema does not allow it. */
export function placeableBlockSetAt(doc, positions, targetPos) {
    if (targetPos < 0 || targetPos > doc.content.size)
        return null;
    for (const pos of positions) {
        const node = doc.nodeAt(pos);
        if (!node || (targetPos >= pos && targetPos <= pos + node.nodeSize))
            return null;
    }
    const content = blockSetContent(doc, positions);
    if (!content)
        return null;
    const $target = doc.resolve(targetPos);
    const index = $target.index();
    if (content.items && $target.parent.canReplace(index, index, content.items))
        return content.items;
    return $target.parent.canReplace(index, index, content.blocks) ? content.blocks : null;
}
/** Valid positions to place the group (used for the indicator while dragging and for the drop). */
export function calculateBlockSetDropPosition(doc, positions, rawTargetPos) {
    const content = blockSetContent(doc, positions);
    if (!content)
        return null;
    const candidates = [content.items, content.blocks].filter((fragment) => !!fragment);
    for (const fragment of candidates) {
        const point = dropPoint(doc, rawTargetPos, new Slice(fragment, 0, 0)) ?? rawTargetPos;
        if (placeableBlockSetAt(doc, positions, point))
            return point;
    }
    return null;
}
/**
 * Deletes lines from the group (from the back). If all items of a list are removed, delete the whole list; if a container becomes empty, leave an empty paragraph.
 * If the whole document becomes empty, leave one empty paragraph.
 */
export function deleteBlockSet(tr, positions) {
    for (const original of [...positions].reverse()) {
        const pos = tr.mapping.map(original);
        const node = tr.doc.nodeAt(pos);
        if (!node)
            continue;
        const source = sourceRangeOf(tr.doc, pos);
        if (source?.fill)
            tr.replaceWith(source.from, source.to, source.fill);
        else if (source)
            tr.delete(source.from, source.to);
        else {
            const paragraph = tr.doc.type.schema.nodes.paragraph;
            if (paragraph)
                tr.replaceWith(pos, pos + node.nodeSize, paragraph.create());
        }
    }
    return tr;
}
/**
 * Moves a block group to targetPos (one undo step). Announces the new positions of the moved lines via MOVED_BLOCKS_META.
 * Same-type lists on both sides of the insertion and between the inserted content are merged.
 */
export function moveBlockSet(state, positions, targetPos) {
    const content = placeableBlockSetAt(state.doc, positions, targetPos);
    if (!content)
        return null;
    const tr = deleteBlockSet(state.tr, positions);
    const insertedAt = tr.mapping.map(targetPos);
    tr.insert(insertedAt, content);
    const afterInsert = tr.steps.length;
    // Position of the moved line: inside the wrapping list for an item, otherwise the block itself.
    const moved = [];
    let offset = insertedAt;
    content.forEach((node) => {
        // A list cannot be picked as a line (the item is the line). The inserted list only wraps the items, and those items are the moved lines.
        if (LIST_NODES.has(node.type.name)) {
            let inner = offset + 1;
            node.forEach((item) => {
                moved.push(inner);
                inner += item.nodeSize;
            });
        }
        else
            moved.push(offset);
        offset += node.nodeSize;
    });
    // Merge boundaries where same-type lists touch, from the back.
    const boundaries = [insertedAt];
    let boundary = insertedAt;
    content.forEach((node) => {
        boundary += node.nodeSize;
        boundaries.push(boundary);
    });
    for (const at of boundaries.reverse()) {
        const $at = tr.doc.resolve(tr.mapping.slice(afterInsert).map(at));
        const before = $at.nodeBefore;
        const after = $at.nodeAfter;
        if (before && after && before.type === after.type && LIST_NODES.has(before.type.name) && canJoin(tr.doc, $at.pos))
            tr.join($at.pos);
    }
    const mapping = tr.mapping.slice(afterInsert);
    const finalPositions = moved.map((pos) => mapping.map(pos, 1));
    const first = finalPositions[0];
    const lastPos = finalPositions[finalPositions.length - 1];
    const last = lastPos === undefined ? undefined : tr.doc.nodeAt(lastPos);
    if (first !== undefined && lastPos !== undefined && last)
        tr.setSelection(TextSelection.between(tr.doc.resolve(first + 1), tr.doc.resolve(lastPos + last.nodeSize - 1)));
    tr.setMeta(MOVED_BLOCKS_META, finalPositions);
    return tr.scrollIntoView();
}
