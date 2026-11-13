import { Extension } from "@tiptap/core";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey, TextSelection, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { canMove, deleteBlock } from "./commands";
import { type Drop, moveBlockTo, spots } from "./drag";

/**
 * Blocks picked whole (doc 03, editor-tools.md, picking several blocks, T80), apart from a text selection: a box dragged from the margin outside the text, a
 * press with Shift on a handle, or Esc on picked words picks the blocks they touch. The picked blocks stand on the selection's ground
 * (`data-picked`); the handle of any of them opens the menu of them all, and dragging it moves them together; Backspace or Delete takes them out,
 * and undo brings them back.
 *
 * The pick is the places of the blocks with a handle (a top-level block, a list item, a block in a quote), in the body's order. So that copy takes
 * them, the body's selection is set from the first to the last as well, its highlight hidden (`data-picking` on the text).
 */
const key = new PluginKey<number[] | null>("montiBlockPick");

export const pickedBlocks = (state: EditorState): number[] | null => key.getState(state) ?? null;

/** In the body's order, each once, and none inside another picked one (a quote's paragraph goes with its quote). */
function normalize(doc: EditorNode, positions: readonly number[]): number[] {
	const sorted = [...new Set(positions)].filter((pos) => pos >= 0 && pos < doc.content.size).sort((a, b) => a - b);
	const result: number[] = [];
	let coveredUntil = -1;
	for (const pos of sorted) {
		const node = doc.nodeAt(pos);
		if (!node || pos < coveredUntil) continue;
		result.push(pos);
		coveredUntil = pos + node.nodeSize;
	}
	return result;
}

/** Picks the blocks at `positions` (none: `null` or empty), with the body's selection over them for copy. */
export function setPick(tr: Transaction, positions: readonly number[] | null): Transaction {
	const picked = positions ? normalize(tr.doc, positions) : [];
	tr.setMeta(key, picked.length > 0 ? picked : null);
	const first = picked[0];
	const lastPos = picked[picked.length - 1];
	const last = lastPos === undefined ? null : tr.doc.nodeAt(lastPos);
	if (first !== undefined && lastPos !== undefined && last)
		tr.setSelection(
			TextSelection.between(
				tr.doc.resolve(Math.min(first + 1, tr.doc.content.size)),
				tr.doc.resolve(Math.max(lastPos + last.nodeSize - 1, 0)),
			),
		);
	return tr;
}

/**
 * The blocks with a handle among `found`, keeping the smallest: a block that holds another of them (a list, a quote) is left for the ones it holds,
 * so a box over two list items picks those items, not their whole list.
 */
function smallest(found: { pos: number; size: number }[]): number[] {
	return found
		.filter(
			(outer) => !found.some((inner) => inner !== outer && inner.pos > outer.pos && inner.pos < outer.pos + outer.size),
		)
		.map((each) => each.pos);
}

/** The blocks a box from `top` to `bottom` (viewport px) touches: every one from the first it touches to the last. */
export function blocksInBox(view: EditorView, top: number, bottom: number): number[] {
	const touched = spots(view).filter((spot) => spot.rect.bottom >= top && spot.rect.top <= bottom);
	return smallest(touched.map((spot) => ({ pos: spot.pos, size: view.state.doc.nodeAt(spot.pos)?.nodeSize ?? 0 })));
}

/** The blocks from one block to another, both included, in the body's order (Shift on a handle). */
export function blocksBetween(view: EditorView, a: number, b: number): number[] {
	const { doc } = view.state;
	const from = Math.min(a, b);
	const endOf = (pos: number) => pos + (doc.nodeAt(pos)?.nodeSize ?? 0);
	const to = Math.max(endOf(a), endOf(b));
	const inside = spots(view).filter((spot) => spot.pos >= from && endOf(spot.pos) <= to);
	return smallest(inside.map((spot) => ({ pos: spot.pos, size: endOf(spot.pos) - spot.pos })));
}

/** The blocks a text selection runs over (Esc on picked words). */
export function blocksOfRange(view: EditorView, from: number, to: number): number[] {
	const { doc } = view.state;
	const touched = spots(view)
		.map((spot) => ({ pos: spot.pos, size: doc.nodeAt(spot.pos)?.nodeSize ?? 0 }))
		.filter((spot) => spot.pos < to && spot.pos + spot.size > from);
	return smallest(touched);
}

/** Takes the picked blocks out, last first; a list or quote left with nothing goes too, and an emptied body keeps one empty line. */
export function deletePicked(tr: Transaction, picked: readonly number[]): Transaction {
	for (const pos of [...picked].sort((a, b) => b - a)) deleteBlock(tr, pos);
	tr.setMeta(key, null);
	const at = Math.min(tr.mapping.map(picked[0] ?? 0), tr.doc.content.size);
	return tr.setSelection(TextSelection.near(tr.doc.resolve(at)));
}

/**
 * Moves the picked blocks to a drop, keeping their order: the first goes where the drop says, each next one after the one before it. Their ids go
 * with them, and they stay picked where they land.
 */
export function movePicked(tr: Transaction, picked: readonly number[], drop: Pick<Drop, "pos" | "side">): Transaction {
	const start = tr.steps.length;
	let anchor: Pick<Drop, "pos" | "side"> = drop;
	const landed: { pos: number; steps: number }[] = [];
	for (const from of picked) {
		const at = moveBlockTo(tr, tr.mapping.slice(start).map(from), anchor);
		if (at === null) continue;
		landed.push({ pos: at, steps: tr.steps.length });
		anchor = { pos: at, side: "after" };
	}
	// Each one's place moved with the ones that came after it: read them in the body as it is now.
	return setPick(
		tr,
		landed.map(({ pos, steps }) => tr.mapping.slice(steps).map(pos)),
	);
}

/** Moves the picked blocks one place up (before the block above the first) or down (after the block under the last). */
export function canMovePicked(doc: EditorNode, picked: readonly number[], direction: -1 | 1): boolean {
	const edge = direction < 0 ? picked[0] : picked[picked.length - 1];
	return edge !== undefined && canMove(doc, edge, direction);
}

export function movePickedBy(tr: Transaction, picked: readonly number[], direction: -1 | 1): Transaction {
	const edge = direction < 0 ? picked[0] : picked[picked.length - 1];
	if (edge === undefined || !canMove(tr.doc, edge, direction)) return tr;
	const $edge = tr.doc.resolve(edge);
	const node = tr.doc.nodeAt(edge);
	if (!node) return tr;
	const sibling = $edge.parent.child($edge.index() + direction);
	const pos = direction < 0 ? edge - sibling.nodeSize : edge + node.nodeSize;
	return movePicked(tr, picked, { pos, side: direction < 0 ? "before" : "after" });
}

/** A copy of the picked blocks: after the last of them when they stand together in one parent, else each after itself. */
export function duplicatePicked(tr: Transaction, picked: readonly number[]): Transaction {
	const nodes = picked.map((pos) => tr.doc.nodeAt(pos));
	const $first = tr.doc.resolve(picked[0] ?? 0);
	const together =
		nodes.every(Boolean) &&
		picked.every((pos, index) => {
			const $pos = tr.doc.resolve(pos);
			return $pos.parent === $first.parent && $pos.index() === $first.index() + index;
		});
	const last = picked[picked.length - 1];
	const lastNode = last === undefined ? null : tr.doc.nodeAt(last);
	if (together && last !== undefined && lastNode) {
		const at = last + lastNode.nodeSize;
		tr.insert(at, nodes as EditorNode[]);
		const copies: number[] = [];
		let pos = at;
		for (const node of nodes as EditorNode[]) {
			copies.push(pos);
			pos += node.nodeSize;
		}
		return setPick(tr, copies);
	}
	for (const pos of [...picked].sort((a, b) => b - a)) {
		const node = tr.doc.nodeAt(pos);
		if (node) tr.insert(pos + node.nodeSize, node);
	}
	return setPick(tr, null);
}

/** A key pressed while blocks are picked: Backspace, Delete and cut take them out; Esc, an arrow or a click lets them go; typing does not overwrite them. */
function pickKey(view: EditorView, event: KeyboardEvent): boolean {
	const picked = pickedBlocks(view.state);
	if (!picked) {
		// Esc on picked words picks the blocks they run over.
		const { selection } = view.state;
		if (event.key !== "Escape" || selection.empty || event.shiftKey || event.metaKey || event.ctrlKey) return false;
		const blocks = blocksOfRange(view, selection.from, selection.to);
		if (blocks.length === 0) return false;
		view.dispatch(setPick(view.state.tr, blocks));
		return true;
	}
	const mod = event.metaKey || event.ctrlKey;
	if (event.key === "Backspace" || event.key === "Delete") {
		view.dispatch(deletePicked(view.state.tr, picked).scrollIntoView());
		return true;
	}
	if (mod && event.key.toLowerCase() === "x") {
		// The copy is the browser's, of the selection laid over the blocks; the blocks go whole.
		document.execCommand("copy");
		view.dispatch(deletePicked(view.state.tr, picked).scrollIntoView());
		return true;
	}
	if (mod || ["Shift", "Alt", "Meta", "Control"].includes(event.key)) return false;
	if (event.key === "Escape") {
		view.dispatch(setPick(view.state.tr, null).setSelection(TextSelection.near(view.state.selection.$from)));
		return true;
	}
	view.dispatch(view.state.tr.setMeta(key, null));
	// An arrow moves the caret from where it is; any other key would write over several blocks at once, and is not taken.
	return !event.key.startsWith("Arrow");
}

export const BlockPick = Extension.create({
	name: "montiBlockPick",
	// Its keys come before the editor's own: Backspace on picked blocks takes them whole, not a letter of the text laid over them.
	priority: 1000,
	addProseMirrorPlugins() {
		return [
			new Plugin<number[] | null>({
				key,
				state: {
					init: () => null,
					apply(tr, value) {
						const meta = tr.getMeta(key) as number[] | null | undefined;
						if (meta !== undefined) return meta;
						if (!value) return null;
						// Another selection lets the pick go.
						if (tr.selectionSet) return null;
						if (!tr.docChanged) return value;
						const mapped = normalize(
							tr.doc,
							value.map((pos) => tr.mapping.map(pos, 1)),
						);
						return mapped.length > 0 ? mapped : null;
					},
				},
				props: {
					attributes: (state): Record<string, string> => (pickedBlocks(state) ? { "data-picking": "" } : {}),
					decorations(state) {
						const picked = pickedBlocks(state);
						if (!picked) return null;
						return DecorationSet.create(
							state.doc,
							picked.flatMap((pos) => {
								const node = state.doc.nodeAt(pos);
								return node ? [Decoration.node(pos, pos + node.nodeSize, { "data-picked": "" })] : [];
							}),
						);
					},
					handleKeyDown: pickKey,
					handleDOMEvents: {
						mousedown(view) {
							// A press in the text starts a caret or picked words of its own.
							if (pickedBlocks(view.state)) view.dispatch(view.state.tr.setMeta(key, null));
							return false;
						},
					},
				},
			}),
		];
	},
});
