import { getMarkRange } from "@tiptap/core";
import { type Node as EditorNode, Fragment, type ResolvedPos, type Schema } from "@tiptap/pm/model";
import { type EditorState, NodeSelection, TextSelection, type Transaction } from "@tiptap/pm/state";
import type { Catalog } from "./catalog";
import { KEPT_MARK, markName, nodeName } from "./schema";

/** A kind a text block can be turned into (the block menu's "turn into", the markdown shortcuts, the "/" menu's text blocks). */
export type Kind =
	| { type: "paragraph" }
	| { type: "heading"; level: number }
	| { type: "bulletList" }
	| { type: "orderedList" }
	| { type: "checklist" }
	| { type: "quote" }
	| { type: "codeBlock" };

export const kindKey = (kind: Kind) => (kind.type === "heading" ? `heading:${kind.level}` : kind.type);

/** The markdown each kind is typed with: shown at the end of its row (editor-tools.md). */
export const KIND_SHORTCUTS: Record<string, string> = {
	paragraph: "",
	"heading:2": "##",
	"heading:3": "###",
	"heading:4": "####",
	bulletList: "-",
	orderedList: "1.",
	checklist: "[]",
	quote: ">",
	codeBlock: "```",
};

const LISTS = ["bulletList", "orderedList", "checklist"];

/** The kinds the collection's editor offers, in the menu's order. */
export function offeredKinds(offered: Catalog): Kind[] {
	const has = (type: string) => offered.blocks.some((block) => block.type === type);
	const kinds: Kind[] = [];
	if (has("paragraph")) kinds.push({ type: "paragraph" });
	if (has("heading")) for (const level of offered.headings) kinds.push({ type: "heading", level });
	for (const type of [...LISTS, "quote", "codeBlock"] as const) if (has(type)) kinds.push({ type } as Kind);
	return kinds;
}

const named = (schema: Schema, type: string) => schema.nodes[nodeName(type)];

/** The kind of a text block, or `null` when it is not one the menu turns (a site's own block). */
export function kindOf(node: EditorNode, parent: EditorNode | null): Kind | null {
	switch (node.type.name) {
		case "paragraph":
			return { type: "paragraph" };
		case "heading":
			return { type: "heading", level: Number(node.attrs.data?.level ?? 2) };
		case "codeBlock":
			return { type: "codeBlock" };
		case nodeName("listItem"): {
			const list = parent?.type.name;
			return list && LISTS.includes(list) ? ({ type: list } as Kind) : null;
		}
	}
	return null;
}

/**
 * The block a handle points to at a place in the body: the top-level block, or deeper a list item or a block inside a block that holds blocks (a
 * quote), so each of those has a handle of its own.
 */
export function handleTarget($pos: ResolvedPos): number | null {
	const lists = new Set(LISTS.map(nodeName));
	const item = nodeName("listItem");
	for (let depth = $pos.depth; depth >= 1; depth--) {
		const node = $pos.node(depth);
		const parent = $pos.node(depth - 1);
		if (depth === 1 || node.type.name === item || (!lists.has(parent.type.name) && parent.type.name !== item))
			return $pos.before(depth);
	}
	return null;
}

/** The node a kind makes from a text block's content, keeping the block's id on the text block. */
function made(schema: Schema, kind: Kind, node: EditorNode): EditorNode {
	const id = node.attrs.blockId;
	const text = node.textContent;
	const content =
		kind.type === "codeBlock"
			? text
				? Fragment.from(schema.text(text))
				: Fragment.empty
			: node.type.name === "codeBlock"
				? text
					? Fragment.from(schema.text(text))
					: Fragment.empty
				: node.content;
	// A paragraph turned into a heading, or back, keeps where its lines sit.
	const align = node.attrs.data?.align as string | undefined;
	switch (kind.type) {
		case "paragraph":
			return named(schema, "paragraph").create({ blockId: id, data: align ? { align } : null }, content);
		case "heading":
			return named(schema, "heading").create(
				{ blockId: id, data: { level: kind.level, ...(align ? { align } : {}) } },
				content,
			);
		case "codeBlock":
			return named(schema, "codeBlock").create({ blockId: id }, content);
		case "quote":
			return named(schema, "quote").create(null, named(schema, "paragraph").create({ blockId: id }, content));
		default:
			return named(schema, kind.type).create(null, named(schema, "listItem").create({ blockId: id }, content));
	}
}

/**
 * Turns the text block at `pos` into `kind`. A list item turned into anything else leaves its list alone: the list is cut around it (editor-tools.md).
 * The cursor stays at the same place in the text.
 */
export function turnInto(tr: Transaction, pos: number, kind: Kind) {
	const node = tr.doc.nodeAt(pos);
	if (!node?.isTextblock) return tr;
	const $pos = tr.doc.resolve(pos);
	const offset = tr.selection.$from.parent === node ? tr.selection.$from.parentOffset : node.content.size;
	const schema = tr.doc.type.schema;
	const next = made(schema, kind, node);
	let start = pos;
	if (node.type.name === nodeName("listItem")) {
		const list = $pos.parent;
		if (list.type.name === nodeName(kind.type) && kind.type !== "paragraph") return tr;
		const listPos = $pos.before($pos.depth);
		const inList = pos - (listPos + 1);
		const before = list.content.cut(0, inList);
		const after = list.content.cut(inList + node.nodeSize);
		const parts: EditorNode[] = [];
		if (before.size) parts.push(list.type.create(list.attrs, before));
		start = listPos + parts.reduce((size, part) => size + part.nodeSize, 0);
		parts.push(next);
		if (after.size) parts.push(list.type.create({ ...list.attrs, blockId: null }, after));
		tr.replaceWith(listPos, listPos + list.nodeSize, parts);
	} else tr.replaceWith(pos, pos + node.nodeSize, next);
	const depth = next.isTextblock ? 1 : 2;
	const inside = Math.min(offset, (next.isTextblock ? next : next.firstChild)?.content.size ?? 0);
	return tr.setSelection(TextSelection.near(tr.doc.resolve(start + depth + inside)));
}

/** Whether the block at `pos` can move one place up (`-1`) or down (`1`) among its siblings. */
export function canMove(doc: EditorNode, pos: number, direction: -1 | 1) {
	const $pos = doc.resolve(pos);
	const index = $pos.index();
	return direction < 0 ? index > 0 : index < $pos.parent.childCount - 1;
}

/** Moves the block at `pos` past its sibling; it keeps its id. */
export function moveBlock(tr: Transaction, pos: number, direction: -1 | 1) {
	const node = tr.doc.nodeAt(pos);
	if (!node || !canMove(tr.doc, pos, direction)) return tr;
	const $pos = tr.doc.resolve(pos);
	const sibling = $pos.parent.child($pos.index() + direction);
	tr.delete(pos, pos + node.nodeSize);
	const at = direction < 0 ? pos - sibling.nodeSize : pos + sibling.nodeSize;
	tr.insert(at, node);
	return tr.setSelection(
		node.isTextblock ? TextSelection.near(tr.doc.resolve(at + 1)) : NodeSelection.create(tr.doc, at),
	);
}

/** A copy of the block below it; the copy gets new ids. */
export function duplicateBlock(tr: Transaction, pos: number) {
	const node = tr.doc.nodeAt(pos);
	if (!node) return tr;
	return tr.insert(pos + node.nodeSize, node);
}

/** Removes the block; a list or quote left with nothing goes too, and an emptied body keeps one empty line. */
export function deleteBlock(tr: Transaction, pos: number) {
	let from = pos;
	let node = tr.doc.nodeAt(pos);
	if (!node) return tr;
	let $pos = tr.doc.resolve(from);
	while ($pos.depth > 0 && $pos.parent.childCount === 1) {
		from = $pos.before($pos.depth);
		node = $pos.parent;
		$pos = tr.doc.resolve(from);
	}
	if ($pos.depth === 0 && tr.doc.childCount === 1)
		return tr.replaceWith(0, tr.doc.content.size, named(tr.doc.type.schema, "paragraph").create());
	return tr.delete(from, from + node.nodeSize);
}

/** The +: an empty line under the block with "/" typed in it, so the "/" menu opens there (editor-tools.md). A list item gets an item. */
export function addBelow(tr: Transaction, pos: number) {
	const node = tr.doc.nodeAt(pos);
	if (!node) return tr;
	const schema = tr.doc.type.schema;
	const type = node.type.name === nodeName("listItem") ? node.type : named(schema, "paragraph");
	const at = pos + node.nodeSize;
	tr.insert(at, type.create(null, schema.text("/")));
	return tr.setSelection(TextSelection.create(tr.doc, at + 2));
}

/** Puts blocks in at the cursor: in place of the empty line it is on, or after its block. */
export function insertBlocks(tr: Transaction, blocks: EditorNode[]) {
	const { $from } = tr.selection;
	const depth = Math.max(1, $from.depth);
	const block = $from.node(depth);
	const at = $from.before(depth);
	if (blocks.length === 0) return tr;
	if (block.isTextblock && block.content.size === 0) tr.replaceWith(at, at + block.nodeSize, blocks);
	else tr.insert(at + block.nodeSize, blocks);
	const end = tr.mapping.map(at + block.nodeSize);
	return tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(end, tr.doc.content.size)), -1));
}

/** The formats "clear formatting" takes off: every mark but a link (where the words go, taken off in the link card) and a kept one (doc 03: kept as it is). */
function clearable(schema: Schema) {
	const keep = new Set([markName("link"), KEPT_MARK]);
	return Object.values(schema.marks).filter((type) => !keep.has(type.name));
}

/** Whether the selected words have a format that "clear formatting" would take off: the format card shows the button only then. */
export function hasClearableFormat(state: EditorState): boolean {
	const { from, to, empty } = state.selection;
	return !empty && clearable(state.schema).some((type) => state.doc.rangeHasMark(from, to, type));
}

/**
 * "Clear formatting" (⌘\, editor-tools.md): takes the formats off the selected words; with nothing selected, off the run of each format the caret is
 * in, so a bold word is cleared without picking it. A link stays. `false` when there is nothing to take off.
 */
export function clearFormats(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
	const types = clearable(state.schema);
	const { from, to, empty, $from } = state.selection;
	const tr = state.tr;
	if (!empty) {
		if (!hasClearableFormat(state)) return false;
		for (const type of types) tr.removeMark(from, to, type);
	} else {
		const here = types.filter((type) => type.isInSet(state.storedMarks ?? $from.marks()));
		if (here.length === 0) return false;
		for (const type of here) {
			const range = getMarkRange($from, type);
			if (range) tr.removeMark(range.from, range.to, type);
		}
		// What is typed next at the caret is plain too.
		tr.setStoredMarks([]);
	}
	dispatch?.(tr.scrollIntoView());
	return true;
}
