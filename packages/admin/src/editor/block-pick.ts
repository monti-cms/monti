import { Extension } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { type Node as EditorNode, Fragment, Slice } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey, type Selection, TextSelection, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { canMove, deleteBlock } from "./commands";
import { type Drop, moveBlockTo, spots } from "./drag";
import { nodeName } from "./names";

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

/** Whether a selection is still the one laid over the pick: inside it, from its first block to its last. */
function spansPick(doc: EditorNode, selection: Selection, picked: readonly number[]): boolean {
	const first = picked[0];
	const last = picked[picked.length - 1];
	const lastNode = last === undefined ? null : doc.nodeAt(last);
	const firstNode = first === undefined ? null : doc.nodeAt(first);
	if (first === undefined || last === undefined || !lastNode || !firstNode || selection.empty) return false;
	return (
		selection.from >= first &&
		selection.from < first + firstNode.nodeSize &&
		selection.to > last &&
		selection.to <= last + lastNode.nodeSize
	);
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
 * The blocks with a handle among `found`: a list or a quote that holds others of them is left for the ones it holds, so a box over two list items
 * picks those items, not their whole list; any other block that holds blocks (a site's callout or tabs, doc 18) is picked whole, its blocks with it.
 */
function smallest(doc: EditorNode, found: { pos: number; size: number }[]): number[] {
	// A quote and a list are read through: their blocks are picked. Any other block that holds blocks (a site's callout, tabs, columns, doc 18) is one
	// block: it is picked whole, and what it holds goes with it.
	const throughOnly = (pos: number) => SEE_THROUGH.has(doc.nodeAt(pos)?.type.name ?? "");
	const holds = (outer: { pos: number; size: number }, inner: { pos: number }) =>
		inner.pos > outer.pos && inner.pos < outer.pos + outer.size;
	return found
		.filter((outer) => !throughOnly(outer.pos) || !found.some((inner) => inner !== outer && holds(outer, inner)))
		.filter((inner) => !found.some((outer) => outer !== inner && !throughOnly(outer.pos) && holds(outer, inner)))
		.map((each) => each.pos);
}
/** The blocks a pick reads through to the blocks they hold. */
const SEE_THROUGH = new Set(["quote", "bulletList", "orderedList", "checklist", "listItem"].map(nodeName));

/** The blocks a box from `top` to `bottom` (viewport px) touches: every one from the first it touches to the last. */
export function blocksInBox(view: EditorView, top: number, bottom: number): number[] {
	const touched = spots(view).filter((spot) => spot.rect.bottom >= top && spot.rect.top <= bottom);
	return smallest(
		view.state.doc,
		touched.map((spot) => ({ pos: spot.pos, size: view.state.doc.nodeAt(spot.pos)?.nodeSize ?? 0 })),
	);
}

/** The block a pick takes for the block at `pos`: the outermost one holding it that a pick does not read through (a quote and a list are read through). */
export function wholeOf(doc: EditorNode, pos: number): number {
	const $pos = doc.resolve(pos);
	for (let depth = 1; depth <= $pos.depth; depth++)
		if (!SEE_THROUGH.has($pos.node(depth).type.name)) return $pos.before(depth);
	return pos;
}

/** The blocks from one block to another, both included, in the body's order (Shift on a handle). */
export function blocksBetween(view: EditorView, a: number, b: number): number[] {
	const { doc } = view.state;
	// An end inside a site block that holds blocks (a callout, tabs) is that whole block, as a box over it is.
	a = wholeOf(doc, a);
	b = wholeOf(doc, b);
	const from = Math.min(a, b);
	const endOf = (pos: number) => pos + (doc.nodeAt(pos)?.nodeSize ?? 0);
	const to = Math.max(endOf(a), endOf(b));
	const inside = spots(view).filter((spot) => spot.pos >= from && endOf(spot.pos) <= to);
	return smallest(
		doc,
		inside.map((spot) => ({ pos: spot.pos, size: endOf(spot.pos) - spot.pos })),
	);
}

/** The blocks a text selection runs over (Esc on picked words). */
export function blocksOfRange(view: EditorView, from: number, to: number): number[] {
	const { doc } = view.state;
	const touched = spots(view)
		.map((spot) => ({ pos: spot.pos, size: doc.nodeAt(spot.pos)?.nodeSize ?? 0 }))
		.filter((spot) => spot.pos < to && spot.pos + spot.size > from);
	return smallest(doc, touched);
}

/**
 * Takes the picked blocks out of the body (the menu's row, Backspace, Delete, cut). First the caret goes to the first of them, outside the undo
 * history: undo then brings the blocks back with a caret, not the text selection laid over them, which Backspace would merge.
 */
export function removePicked(view: EditorView, picked: readonly number[]) {
	const caret = TextSelection.near(view.state.doc.resolve(Math.min((picked[0] ?? 0) + 1, view.state.doc.content.size)));
	view.dispatch(view.state.tr.setSelection(caret).setMeta(key, picked).setMeta("addToHistory", false));
	view.dispatch(deletePicked(view.state.tr, picked).scrollIntoView());
}

/** Takes the picked blocks out, last first; a list or quote left with nothing goes too, and an emptied body keeps one empty line. */
export function deletePicked(tr: Transaction, picked: readonly number[]): Transaction {
	// Its own step of undo: a move, copy or delete made right after another is not undone with it.
	closeHistory(tr);
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
	// Its own step of undo: a move, copy or delete made right after another is not undone with it.
	closeHistory(tr);
	// Each block is found again by its id before it moves: a move that cuts a list in two replaces the list whole, and a place read through that
	// change would point at the block after it.
	const ids = picked.map((pos) => idAt(tr.doc, pos));
	const start = tr.steps.length;
	const placeOf = (index: number) => {
		const id = ids[index];
		return id ? findBlock(tr.doc, id) : tr.mapping.slice(start).map(picked[index] ?? 0);
	};
	let anchor: Pick<Drop, "pos" | "side"> = drop;
	const moved: number[] = [];
	for (let index = 0; index < picked.length; index++) {
		const from = placeOf(index);
		if (from === null) continue;
		if (index > 0) {
			const before = moved.length > 0 ? placeOf(moved[moved.length - 1] ?? 0) : null;
			if (before !== null) anchor = { pos: before, side: "after" };
		}
		if (moveBlockTo(tr, from, anchor) !== null) moved.push(index);
	}
	return setPick(
		tr,
		moved.map(placeOf).filter((pos): pos is number => pos !== null),
	);
}

/** The id a block keeps through moves (doc 03), or `null` for one without. */
const idAt = (doc: EditorNode, pos: number): string | null => {
	const id = doc.nodeAt(pos)?.attrs.blockId;
	return typeof id === "string" && id !== "" ? id : null;
};

/** Where the block with this id is now. */
function findBlock(doc: EditorNode, id: string): number | null {
	let found: number | null = null;
	doc.descendants((node, pos) => {
		if (found !== null) return false;
		if (node.attrs.blockId === id) found = pos;
		return found === null && !node.isTextblock;
	});
	return found;
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
	// Its own step of undo: a move, copy or delete made right after another is not undone with it.
	closeHistory(tr);
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

/** Lets the pick go, with a caret where the picked blocks began: nothing typed next can write over all of them. */
function letGo(view: EditorView) {
	const { selection } = view.state;
	view.dispatch(setPick(view.state.tr, null).setSelection(TextSelection.near(selection.$from)));
}

/** A key pressed while blocks are picked: Backspace, Delete and cut take them out; Esc, an arrow or a click lets them go; typing does not overwrite them. */
function pickKey(view: EditorView, event: KeyboardEvent): boolean {
	const picked = pickedBlocks(view.state);
	if (!picked) {
		// Esc on picked words picks the blocks they run over.
		const { selection } = view.state;
		if (event.key !== "Escape" || selection.empty || event.shiftKey || event.metaKey || event.ctrlKey) return false;
		if (view.composing || event.isComposing) return false;
		const blocks = blocksOfRange(view, selection.from, selection.to);
		if (blocks.length === 0) return false;
		view.dispatch(setPick(view.state.tr, blocks));
		return true;
	}
	// A syllable starting (Korean comes through composition): the caret goes first, so the syllable is written there, not over every block.
	if (view.composing || event.isComposing || event.keyCode === 229) {
		letGo(view);
		return false;
	}
	const mod = event.metaKey || event.ctrlKey;
	if (event.key === "Backspace" || event.key === "Delete") {
		removePicked(view, picked);
		return true;
	}
	if (mod && event.key.toLowerCase() === "x") {
		// The clipboard gets the picked blocks themselves (the `cut` handler below); then they go whole.
		document.execCommand("copy");
		removePicked(view, picked);
		return true;
	}
	if (mod || ["Shift", "Alt", "Meta", "Control"].includes(event.key)) return false;
	if (event.key.startsWith("Arrow")) {
		// The arrow moves the caret on from where the picked blocks began.
		letGo(view);
		return false;
	}
	// Esc, Enter, a letter: the pick goes, and the key does nothing more (a letter would write over several blocks at once).
	letGo(view);
	return true;
}

/** The picked blocks as a slice for the clipboard: list items in a list of their kind, so they paste as list items. */
function pickedSlice(state: EditorState, picked: readonly number[]): Slice {
	const item = nodeName("listItem");
	const nodes: EditorNode[] = [];
	for (const pos of picked) {
		const node = state.doc.nodeAt(pos);
		if (!node) continue;
		if (node.type.name !== item) {
			nodes.push(node);
			continue;
		}
		const list = state.doc.resolve(pos).parent;
		const last = nodes[nodes.length - 1];
		if (last?.type === list.type) nodes[nodes.length - 1] = last.copy(last.content.addToEnd(node));
		else nodes.push(list.type.create({ ...list.attrs, blockId: null }, node));
	}
	return new Slice(Fragment.from(nodes), 0, 0);
}

/** Puts the picked blocks on the clipboard, as the editor puts any of its content there. */
function copyPicked(view: EditorView, event: ClipboardEvent): boolean {
	const picked = pickedBlocks(view.state);
	if (!picked || !event.clipboardData) return false;
	const { dom, text } = view.serializeForClipboard(pickedSlice(view.state, picked));
	event.preventDefault();
	event.clipboardData.clearData();
	event.clipboardData.setData("text/html", dom.innerHTML);
	event.clipboardData.setData("text/plain", text);
	return true;
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
						// Another selection lets the pick go. The same one read back from the page does not: a block drawn by its own view (a code
						// block) can hand the browser's reading of the selection laid over the pick back a step off.
						if (tr.selectionSet && (tr.docChanged || !spansPick(tr.doc, tr.selection, value))) return null;
						if (!tr.docChanged) return value;
						// A picked block the change took out leaves the pick; it does not hand its place to the block after it.
						const mapped = normalize(
							tr.doc,
							value.flatMap((pos) => {
								const result = tr.mapping.mapResult(pos, 1);
								return result.deletedAfter ? [] : [result.pos];
							}),
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
						copy: copyPicked,
						cut(view, event) {
							const picked = pickedBlocks(view.state);
							if (!picked || !copyPicked(view, event)) return false;
							removePicked(view, picked);
							return true;
						},
					},
				},
			}),
		];
	},
});
