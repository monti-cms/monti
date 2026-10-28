import { type Editor, Extension } from "@tiptap/core";
import { Fragment, type Node as PmNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { type TargetBlock, targetBlockAt } from "./drag/block-resolve";

/**
 * Block operations: move up/down, duplicate, delete. The block handle menu and keyboard shortcuts use the same commands.
 * Supports paragraphs, custom blocks (raw-source box, image, table), and nested blocks (list items, inside blockquotes).
 */

interface TopLevelBlock {
	index: number;
	start: number;
	end: number;
	node: PmNode;
}

const isTargetBlock = (block: TargetBlock | TopLevelBlock): block is TargetBlock => "parent" in block;

/** Top-level block containing the document position: where a block command falls back to when no nested target block is there. */
export function topLevelBlockAt(doc: PmNode, pos: number): TopLevelBlock | null {
	if (doc.childCount === 0) return null;
	const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
	const index = Math.min($pos.index(0), doc.childCount - 1);
	let start = 0;
	for (let i = 0; i < index; i++) start += doc.child(i).nodeSize;
	const node = doc.child(index);
	return { index, start, end: start + node.nodeSize, node };
}

const selectionInside = (doc: PmNode, from: number) =>
	TextSelection.near(doc.resolve(Math.min(from + 1, doc.content.size)));

/** Whether the block at `pos` has a neighbor to swap with in that direction. The block menu hides "up" on the first block and "down" on the last. */
export function canMoveBlock(doc: PmNode, pos: number, direction: -1 | 1): boolean {
	const target = targetBlockAt(doc, pos) ?? topLevelBlockAt(doc, pos);
	if (!target) return false;
	const parent: PmNode = isTargetBlock(target) ? target.parent : doc;
	const neighborIndex = target.index + direction;
	return neighborIndex >= 0 && neighborIndex < parent.childCount;
}

export function moveBlock(editor: Editor, pos: number, direction: -1 | 1): boolean {
	const { state } = editor;
	const target = targetBlockAt(state.doc, pos) ?? topLevelBlockAt(state.doc, pos);
	if (!target) return false;

	const parent: PmNode = isTargetBlock(target) ? target.parent : state.doc;
	const neighborIndex = target.index + direction;
	if (neighborIndex < 0 || neighborIndex >= parent.childCount) return false;

	const neighbor = parent.child(neighborIndex);
	const from = direction < 0 ? target.start - neighbor.nodeSize : target.start;
	const to = direction < 0 ? target.end : target.end + neighbor.nodeSize;
	const ordered = direction < 0 ? [target.node, neighbor] : [neighbor, target.node];
	const tr = state.tr.replaceWith(from, to, Fragment.fromArray(ordered));
	const movedStart = direction < 0 ? from : from + neighbor.nodeSize;
	tr.setSelection(selectionInside(tr.doc, movedStart)).scrollIntoView();
	editor.view.dispatch(tr);
	return true;
}

export function duplicateBlock(editor: Editor, pos: number): boolean {
	const { state } = editor;
	const target = targetBlockAt(state.doc, pos) ?? topLevelBlockAt(state.doc, pos);
	if (!target) return false;
	const $target = state.doc.resolve(target.start);
	if (!$target.parent.canReplaceWith($target.index() + 1, $target.index() + 1, target.node.type)) return false;
	const tr = state.tr.insert(target.end, target.node.copy(target.node.content));
	tr.setSelection(selectionInside(tr.doc, target.end)).scrollIntoView();
	editor.view.dispatch(tr);
	return true;
}

/**
 * Puts an empty line under the block at `pos` with a `/` typed in it, and the cursor after it: the same state as typing the slash on a new line, so the block list
 * opens by the same rule. A block that cannot take a paragraph after it (a list item) gets the line after its top-level block.
 */
export function addBlockBelow(editor: Editor, pos: number): boolean {
	const { state } = editor;
	const paragraph = state.schema.nodes.paragraph;
	const target = targetBlockAt(state.doc, pos) ?? topLevelBlockAt(state.doc, pos);
	if (!paragraph || !target) return false;
	const $target = state.doc.resolve(target.start);
	const inPlace = $target.parent.canReplaceWith($target.index() + 1, $target.index() + 1, paragraph);
	const at = inPlace ? target.end : (topLevelBlockAt(state.doc, pos)?.end ?? target.end);
	const line = paragraph.create(null, state.schema.text("/"));
	const tr = state.tr.insert(at, line);
	tr.setSelection(TextSelection.create(tr.doc, at + 2)).scrollIntoView();
	editor.view.dispatch(tr);
	editor.view.focus();
	return true;
}

export function deleteBlock(editor: Editor, pos: number): boolean {
	const { state } = editor;
	const target = targetBlockAt(state.doc, pos) ?? topLevelBlockAt(state.doc, pos);
	if (!target) return false;
	const $target = state.doc.resolve(target.start);
	if (!$target.parent.canReplace($target.index(), $target.index() + 1)) return false;
	const tr = state.tr.delete(target.start, target.end);
	if (tr.doc.childCount > 0) tr.setSelection(selectionInside(tr.doc, Math.min(target.start, tr.doc.content.size - 1)));
	editor.view.dispatch(tr);
	return true;
}

/** Shortcuts to operate blocks without a mouse. */
export const CmsBlockKeymap = Extension.create({
	name: "cmsBlockKeymap",
	addKeyboardShortcuts() {
		// The keyboard operates on top-level blocks, as in v1. Nested blocks are moved by handle drag or the menu.
		const at = () => {
			const { doc, selection } = this.editor.state;
			return topLevelBlockAt(doc, selection.from)?.start ?? selection.from;
		};
		return {
			"Alt-ArrowUp": () => moveBlock(this.editor, at(), -1),
			"Alt-ArrowDown": () => moveBlock(this.editor, at(), 1),
			"Mod-Shift-d": () => duplicateBlock(this.editor, at()),
			"Mod-Shift-Backspace": () => deleteBlock(this.editor, at()),
		};
	},
});
