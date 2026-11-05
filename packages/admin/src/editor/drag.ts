import type { Node as EditorNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { handleTarget } from "./commands";
import { nodeName } from "./schema";

/** A block that has a handle, and where it is on screen. */
type Spot = { pos: number; rect: DOMRect; element: HTMLElement };

/** Where a dragged block lands: before or after the block at `pos`; `line` is where the drop line is drawn. */
export type Drop = { pos: number; side: "before" | "after"; line: { top: number; left: number; width: number } };

const LISTS = ["bulletList", "orderedList", "checklist"].map(nodeName);

/** Every block with a handle (the top-level blocks, list items, blocks inside a quote), with its element. */
function spots(view: EditorView): Spot[] {
	const found: Spot[] = [];
	view.state.doc.descendants((node, pos) => {
		if (!node.isBlock) return false;
		if (handleTarget(view.state.doc.resolve(pos + 1)) === pos || (node.isAtom && pos >= 0)) {
			const element = view.nodeDOM(pos);
			if (element instanceof HTMLElement) found.push({ pos, rect: element.getBoundingClientRect(), element });
		}
		return !node.isTextblock;
	});
	return found;
}

/**
 * The block under a pointer that has a handle. The pointer may be in the margin left of the text (on its way to the handle, or over a list's
 * bullets), so the block is found by the line the pointer is on, not by the element under it: the smallest block whose box spans that line.
 */
export function blockAtLine(view: EditorView, y: number): Spot | null {
	let best: Spot | null = null;
	for (const spot of spots(view))
		if (y >= spot.rect.top && y <= spot.rect.bottom && (!best || spot.rect.height <= best.rect.height)) best = spot;
	return best;
}

/** The space a block keeps above and below it, so the drop line sits in the middle of the gap between two blocks. */
const margin = (element: HTMLElement, side: "top" | "bottom") =>
	Number.parseFloat(getComputedStyle(element)[side === "top" ? "marginTop" : "marginBottom"]) || 0;

/** Where a block dragged from `from` would land with the pointer at `y`, or `null` over the block itself. */
export function dropAt(view: EditorView, from: number, y: number): Drop | null {
	const dragged = view.state.doc.nodeAt(from);
	if (!dragged) return null;
	const end = from + dragged.nodeSize;
	const all = spots(view).filter((spot) => spot.pos < from || spot.pos >= end);
	if (all.length === 0) return null;
	// The block whose line the pointer is on, or else the nearest one.
	const containing = all.filter((spot) => y >= spot.rect.top && y <= spot.rect.bottom);
	const target =
		containing.sort((a, b) => a.rect.height - b.rect.height)[0] ??
		all.sort(
			(a, b) =>
				Math.min(Math.abs(y - a.rect.top), Math.abs(y - a.rect.bottom)) -
				Math.min(Math.abs(y - b.rect.top), Math.abs(y - b.rect.bottom)),
		)[0];
	if (!target) return null;
	const side = y < target.rect.top + target.rect.height / 2 ? "before" : "after";
	// A list holds its items: next to a list item, the line is inside the list; next to the list, outside it.
	const gap = side === "before" ? -margin(target.element, "top") / 2 : margin(target.element, "bottom") / 2;
	const top = (side === "before" ? target.rect.top : target.rect.bottom) + gap - 1;
	return { pos: target.pos, side, line: { top, left: target.rect.left, width: target.rect.width } };
}

/**
 * Moves the block at `from` before or after another (doc 03: a block keeps its id when it moves). A block that a list does not take, dropped between
 * two of its items, cuts the list in two around it; a list item dropped where items are not taken goes in a list of its own kind. A list or quote
 * left with nothing goes too.
 */
export function moveTo(tr: Transaction, from: number, drop: Pick<Drop, "pos" | "side">) {
	const node = tr.doc.nodeAt(from);
	const anchor = tr.doc.nodeAt(drop.pos);
	if (!node || !anchor || (drop.pos >= from && drop.pos < from + node.nodeSize)) return tr;
	const $from = tr.doc.resolve(from);
	const sourceList = node.type.name === nodeName("listItem") ? $from.parent.type : null;

	// Take the block out, and an emptied parent with it.
	let cut = from;
	let size = node.nodeSize;
	let $cut = $from;
	while ($cut.depth > 0 && $cut.parent.childCount === 1) {
		cut = $cut.before($cut.depth);
		size = $cut.parent.nodeSize;
		$cut = tr.doc.resolve(cut);
	}
	tr.delete(cut, cut + size);

	const anchorPos = tr.mapping.map(drop.pos);
	const at = tr.doc.nodeAt(anchorPos);
	if (!at) return tr;
	const $at = tr.doc.resolve(anchorPos);
	const parent = $at.parent;
	const index = $at.index();
	const place = drop.side === "before" ? anchorPos : anchorPos + at.nodeSize;
	const placeIndex = drop.side === "before" ? index : index + 1;
	let inserted: number;
	let block: EditorNode = node;

	if (parent.canReplaceWith(placeIndex, placeIndex, node.type)) {
		tr.insert(place, node);
		inserted = place;
	} else if (LISTS.includes(parent.type.name)) {
		// Between two list items: the list is cut in two around the block.
		const listPos = $at.before($at.depth);
		const inList = place - (listPos + 1);
		const before = parent.content.cut(0, inList);
		const after = parent.content.cut(inList);
		const parts: EditorNode[] = [];
		if (before.size) parts.push(parent.type.create(parent.attrs, before));
		inserted = listPos + parts.reduce((total, part) => total + part.nodeSize, 0);
		parts.push(node);
		if (after.size) parts.push(parent.type.create({ ...parent.attrs, blockId: null }, after));
		tr.replaceWith(listPos, listPos + parent.nodeSize, parts);
	} else if (sourceList) {
		// A list item where items are not taken: in a list of its own kind.
		block = sourceList.create(null, node);
		tr.insert(place, block);
		inserted = place;
	} else return tr;

	const landed = tr.doc.nodeAt(inserted);
	if (landed?.isTextblock || landed?.firstChild?.isTextblock)
		return tr.setSelection(TextSelection.near(tr.doc.resolve(inserted + (landed.isTextblock ? 1 : 2))));
	return landed ? tr.setSelection(NodeSelection.create(tr.doc, inserted)) : tr;
}
