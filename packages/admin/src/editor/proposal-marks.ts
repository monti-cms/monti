import { applyOps, type BodyOp, type Doc, type NewBlock, plainText } from "@monti-cms/core";
import { PROPOSAL_MARK_CLASSES } from "@monti-cms/ui";
import { type Editor, Extension } from "@tiptap/core";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Catalog } from "./catalog";
import { docFromEditor, docToEditor } from "./convert";

/**
 * The assistant's body proposals drawn over the text (doc 03 principle 5, doc 05; T32). A proposal is a `body.edit` item: block operations that name
 * blocks by id. Text it takes out is blue and struck through, text it puts in is on the pale blue ground, a block it removes is struck through whole,
 * and a block it puts in shows where it goes. The proposal being looked at has the blue line in the margin of its blocks. A proposal whose blocks
 * or text are no longer there to point at, or whose block's words are no longer the ones it was made on, is not drawn over the text: it is
 * stale, and hangs beside its block as "changed in the meantime" (`staleProposals`; T87).
 */

export type BodyProposal = {
	id: string;
	ops: BodyOp[];
	/** The words of the blocks it changes as they were when it was proposed, by block id (the write's `preview.was`). */
	was?: Record<string, string>;
};
type State = { items: BodyProposal[]; current: string | null };

export const proposalMarksKey = new PluginKey<State>("montiProposalMarks");

/** Shows these proposals, the one looked at marked. */
export const showProposals = (state: EditorState, items: BodyProposal[], current: string | null) =>
	state.tr.setMeta(proposalMarksKey, { items, current } satisfies State).setMeta("addToHistory", false);

/** The block with this id in the editor, and where it is. */
export function findBlock(doc: EditorNode, id: string): { pos: number; node: EditorNode } | null {
	let found: { pos: number; node: EditorNode } | null = null;
	doc.descendants((node, pos) => {
		if (found) return false;
		if (node.isBlock && node.attrs.blockId === id) {
			found = { pos, node };
			return false;
		}
	});
	return found;
}

/** The plain text of a textblock as `body.read` counts it: a hard break is one character, a footnote's number none. */
function blockText(node: EditorNode) {
	let text = "";
	node.forEach((child) => {
		if (child.isText) text += child.text;
		else if (child.type.name === "hardBreak") text += "\n";
	});
	return text;
}

/** The editor position of a plain-text offset inside a textblock at `pos`. */
function textPos(node: EditorNode, pos: number, offset: number): number {
	let counted = 0;
	let at = pos + 1;
	let result: number | null = null;
	node.forEach((child) => {
		if (result !== null) return;
		const length = child.isText ? (child.text?.length ?? 0) : child.type.name === "hardBreak" ? 1 : 0;
		if (offset <= counted + length && length > 0) result = at + (offset - counted);
		counted += length;
		at += child.nodeSize;
	});
	return result ?? at;
}

/** A new block's text, for the blue line that shows where it goes. */
const newText = (block: NewBlock): string =>
	block.content ? plainText(block.content) : (block.children ?? []).map((child) => newText(child)).join(" ");

const element = (tag: string, className: string, text: string) => {
	const node = document.createElement(tag);
	node.className = className;
	node.textContent = text;
	return node;
};

/** A line put in: a block of its own with the inserted text on the pale blue ground. */
const insertedBlocks = (blocks: NewBlock[], current: boolean) => () => {
	const box = document.createElement("div");
	box.setAttribute("data-proposal-insert", "");
	// The proposal looked at: its blue line is beside the new lines themselves.
	if (current) box.className = PROPOSAL_MARK_CLASSES.current;
	for (const block of blocks) {
		const line = document.createElement("p");
		line.append(element("ins", PROPOSAL_MARK_CLASSES.ins, newText(block)));
		box.append(line);
	}
	return box;
};

type Drawn = { decorations: Decoration[]; blocks: { pos: number; end: number; scrollOnly?: boolean }[] };

/** Whether a block's words are still the ones the proposal was made on. A block that is not text, or a proposal that kept no words, says nothing against it. */
const asItWas = (item: BodyProposal, id: string, node: EditorNode) =>
	!node.isTextblock || item.was?.[id] === undefined || item.was[id] === blockText(node);

/** The class of words that fill an empty place (the `Fill` part): blue letters, no ground. */
const FILL = "text-monti-proposal";

/**
 * Whether a block is a translation's undecided text, emptied for the source's words to show as its placeholder (doc 04): the stored
 * block still holds those words, which is what a proposal's offsets and its `was` are counted in. A proposal for it is the block's
 * translation, drawn as the words that fill it.
 */
function emptied(doc: EditorNode, found: { pos: number; node: EditorNode }): boolean {
	if (!found.node.isTextblock || found.node.content.size > 0) return false;
	const $pos = doc.resolve(found.pos);
	const top = $pos.depth === 0 ? found.node : $pos.node(1);
	return (top.attrs.link as { state?: string } | null)?.state === "pending";
}

/** What a change of an emptied block's text makes of the words the block is stored with. */
const filledWith = (item: BodyProposal, op: Extract<BodyOp, { op: "replaceText" }>) => {
	const was = item.was?.[op.block];
	return was === undefined ? op.text : was.slice(0, op.from) + op.text + was.slice(op.to);
};

/** One proposal's marks, or `null` when what it points at is not there as it expects (stale). */
function draw(doc: EditorNode, item: BodyProposal, current = false): Drawn | null {
	const decorations: Decoration[] = [];
	const blocks: Drawn["blocks"] = [];
	const touch = (pos: number, node: EditorNode) => blocks.push({ pos, end: pos + node.nodeSize });
	// The blocks it changes hold the words it was made on: offsets counted in other words would strike the wrong ones.
	for (const op of item.ops)
		for (const id of op.op === "remove" ? op.blocks : op.op === "insert" ? [] : [op.block]) {
			const found = findBlock(doc, id);
			if (found && !emptied(doc, found) && !asItWas(item, id, found.node)) return null;
		}
	for (const [at, op] of item.ops.entries()) {
		// A widget is kept by its key: a change made again at its place (the same item, other words) must be drawn anew.
		const key = `${item.id}:${at}:${current}:${JSON.stringify(op)}`;
		switch (op.op) {
			case "replaceText": {
				const found = findBlock(doc, op.block);
				if (!found?.node.isTextblock) return null;
				// An undecided block of a translation: the words that fill it, in blue, where its own words will stand.
				if (emptied(doc, found)) {
					const words = filledWith(item, op);
					decorations.push(
						Decoration.widget(found.pos + 1, () => element("span", FILL, words), { side: 1, key }),
						Decoration.node(found.pos, found.pos + found.node.nodeSize, { "data-proposal-fill": "" }),
					);
					touch(found.pos, found.node);
					break;
				}
				const text = blockText(found.node);
				if (op.from > op.to || op.to > text.length) return null;
				const from = textPos(found.node, found.pos, op.from);
				const to = textPos(found.node, found.pos, op.to);
				if (to > from) decorations.push(Decoration.inline(from, to, { class: PROPOSAL_MARK_CLASSES.del }));
				if (op.text)
					decorations.push(
						Decoration.widget(to, () => element("ins", PROPOSAL_MARK_CLASSES.ins, op.text), { side: 1, key }),
					);
				touch(found.pos, found.node);
				break;
			}
			case "remove":
				for (const id of op.blocks) {
					const found = findBlock(doc, id);
					if (!found) return null;
					decorations.push(
						Decoration.node(found.pos, found.pos + found.node.nodeSize, { class: PROPOSAL_MARK_CLASSES.del }),
					);
					touch(found.pos, found.node);
				}
				break;
			case "setBlock":
			case "move": {
				const found = findBlock(doc, op.block);
				if (!found) return null;
				const end = found.pos + found.node.nodeSize;
				if (op.op === "setBlock" && emptied(doc, found)) {
					const words = newText(op.value);
					decorations.push(
						Decoration.widget(found.pos + 1, () => element("span", FILL, words), { side: 1, key }),
						Decoration.node(found.pos, end, { "data-proposal-fill": "" }),
					);
					touch(found.pos, found.node);
					break;
				}
				decorations.push(Decoration.node(found.pos, end, { class: PROPOSAL_MARK_CLASSES.del }));
				touch(found.pos, found.node);
				if (op.op === "setBlock") {
					decorations.push(Decoration.widget(end, insertedBlocks([op.value], current), { side: 1, key }));
					break;
				}
				const after = op.after === null ? null : findBlock(doc, op.after);
				if (op.after !== null && !after) return null;
				const place = after ? after.pos + after.node.nodeSize : 0;
				const moved: NewBlock = {
					type: found.node.type.name,
					content: [{ type: "text", text: found.node.textContent }],
				};
				decorations.push(Decoration.widget(place, insertedBlocks([moved], current), { side: 1, key }));
				break;
			}
			case "insert": {
				const after = op.after === null ? null : findBlock(doc, op.after);
				if (op.after !== null && !after) return null;
				const place = after ? after.pos + after.node.nodeSize : 0;
				decorations.push(Decoration.widget(place, insertedBlocks(op.blocks, current), { side: 1, key }));
				// Scrolled to by the block it goes after; its blue line is on the new lines.
				if (after) blocks.push({ pos: after.pos, end: after.pos + after.node.nodeSize, scrollOnly: true });
				break;
			}
		}
	}
	return { decorations, blocks };
}

/** The undecided blocks of a translation that a drawn proposal fills: their placeholder (the source's words) gives way to the proposal's. */
export function filledBlocks(state: EditorState): Set<number> {
	const shown = proposalMarksKey.getState(state);
	const filled = new Set<number>();
	for (const item of shown?.items ?? []) {
		if (draw(state.doc, item) === null) continue;
		for (const op of item.ops) {
			if (op.op !== "replaceText" && op.op !== "setBlock") continue;
			const found = findBlock(state.doc, op.block);
			if (found && emptied(state.doc, found)) filled.add(found.pos);
		}
	}
	return filled;
}

/** The proposals that can be drawn on this body now, in order: the bubble walks these. */
export const drawable = <T extends BodyProposal>(doc: EditorNode, items: T[]): T[] =>
	items.filter((item) => draw(doc, item) !== null);

/** The block a proposal names first that is still in the body: where a stale one hangs. `null`: it has no place left. */
export function anchorBlock(doc: EditorNode, item: BodyProposal): string | null {
	for (const op of item.ops)
		for (const id of op.op === "remove"
			? op.blocks
			: op.op === "insert"
				? op.after === null
					? []
					: [op.after]
				: [op.block])
			if (findBlock(doc, id)) return id;
	return null;
}

/**
 * The proposals that cannot be drawn on this body any more and still have a block to hang beside (T87), each with that block: the text
 * moved on since they were made. One whose blocks are all gone has no place in the editor; it waits on its conversation's card.
 */
export const staleProposals = <T extends BodyProposal>(doc: EditorNode, items: T[]): { item: T; block: string }[] =>
	items.flatMap((item) => {
		if (draw(doc, item) !== null) return [];
		const block = anchorBlock(doc, item);
		return block === null ? [] : [{ item, block }];
	});

/** What a stale proposal would have put in its block's place: the words after its change, or none when it takes the block out. */
export function proposedWords(item: BodyProposal, block: string): string | null {
	const was = item.was?.[block];
	for (const op of item.ops) {
		if (op.op === "replaceText" && op.block === block)
			return was === undefined ? op.text : was.slice(0, op.from) + op.text + was.slice(op.to);
		if (op.op === "setBlock" && op.block === block) return newText(op.value);
		if (op.op === "remove" && op.blocks.includes(block)) return null;
		if (op.op === "insert" && op.after === block) return op.blocks.map(newText).join(" ");
		if (op.op === "move" && op.block === block) return was ?? "";
	}
	return "";
}

/** Where a proposal's first block is, for scrolling to it. */
export function proposalStart(doc: EditorNode, item: BodyProposal): number | null {
	return draw(doc, item)?.blocks[0]?.pos ?? null;
}

/** Scrolls the proposal's first block into view, below the editor's head. */
export function scrollToProposal(view: EditorView, item: BodyProposal) {
	const pos = proposalStart(view.state.doc, item);
	if (pos === null) return;
	const dom = view.nodeDOM(pos);
	if (dom instanceof HTMLElement) dom.scrollIntoView({ block: "center", behavior: "smooth" });
}

/** How the editor's body becomes a stored one and back: a proposal's block operations are the core's own (`applyOps`). */
export type Convert = { toEditor: (doc: Doc) => EditorNode; fromEditor: (node: EditorNode) => Doc };

/** Replaces only the top-level blocks of `tr.doc` that differ from `next`, in one step. */
function replaceChanged(tr: Transaction, next: EditorNode) {
	const before = tr.doc;
	let start = 0;
	while (start < before.childCount && start < next.childCount && before.child(start).eq(next.child(start))) start++;
	let endBefore = before.childCount;
	let endNext = next.childCount;
	while (endBefore > start && endNext > start && before.child(endBefore - 1).eq(next.child(endNext - 1))) {
		endBefore--;
		endNext--;
	}
	const offset = (node: EditorNode, index: number) => {
		let pos = 0;
		for (let at = 0; at < index; at++) pos += node.child(at).nodeSize;
		return pos;
	};
	const blocks: EditorNode[] = [];
	for (let at = start; at < endNext; at++) blocks.push(next.child(at));
	tr.replaceWith(offset(before, start), offset(before, endBefore), blocks);
}

/**
 * The body's last block when it is the empty paragraph that is only where the cursor was put under a block with no text of its own, and so
 * is not in the stored body: `null` when the last block is stored like any other.
 */
function openLine(doc: EditorNode, stored: Doc): EditorNode | null {
	const last = doc.lastChild;
	if (!last || doc.childCount < 2 || last.type.name !== "paragraph" || last.content.size > 0) return null;
	return stored.blocks.at(-1)?.id === last.attrs.blockId ? null : last;
}

/**
 * Takes a proposal into the body: a text change goes in exactly where it is (so a caret in that block stays put), and a block change replaces only
 * the blocks it changes. All in one transaction that undo takes back.
 */
export function takeProposal(state: EditorState, item: BodyProposal, convert: Convert): Transaction {
	const tr = state.tr;
	for (const op of item.ops) {
		if (op.op === "replaceText") {
			const found = findBlock(tr.doc, op.block);
			if (!found) continue;
			// An undecided block of a translation holds nothing in the editor: its translation goes in whole (the block is then translated).
			if (emptied(tr.doc, found)) {
				const words = filledWith(item, op);
				if (words) tr.insertText(words, found.pos + 1);
				continue;
			}
			const from = textPos(found.node, found.pos, op.from);
			const to = textPos(found.node, found.pos, op.to);
			if (op.text) tr.insertText(op.text, from, to);
			else tr.delete(from, to);
			continue;
		}
		const stored = convert.fromEditor(tr.doc);
		const next = convert.toEditor(applyOps(stored, [op]));
		// The empty paragraph a person just opened under a last picture or file is not stored (`docFromEditor`), so the body that comes
		// back has none: put in as it came, the paragraph went, and the caret that stood in it with it (T121). It is the editor's own and
		// stays where it is, whatever the proposal changed above it.
		const open = openLine(tr.doc, stored);
		replaceChanged(tr, open ? next.copy(next.content.addToEnd(open)) : next);
	}
	return tr;
}

/** Takes a proposal into an editor's body. */
export function takeInEditor(editor: Editor, item: BodyProposal, kit: Catalog) {
	const convert: Convert = {
		toEditor: (doc) => editor.schema.nodeFromJSON(docToEditor(doc, kit)),
		fromEditor: (node) => docFromEditor(node.toJSON(), kit),
	};
	editor.view.dispatch(takeProposal(editor.state, item, convert));
}

/** The proposal whose blocks hold the caret, if any: changing such a block takes its proposal first (components/proposal.md). */
export function proposalAtCaret(state: EditorState): BodyProposal | null {
	const shown = proposalMarksKey.getState(state);
	if (!shown) return null;
	const { from } = state.selection;
	for (const item of shown.items) {
		const drawn = draw(state.doc, item);
		if (drawn?.blocks.some((block) => !block.scrollOnly && from > block.pos && from < block.end)) return item;
	}
	return null;
}

/** Keys that change text: a printed character, deleting, a new line, or the first key of a composition (Korean). */
const changes = (event: KeyboardEvent) =>
	!event.metaKey &&
	!event.ctrlKey &&
	!event.altKey &&
	(event.key.length === 1 || ["Backspace", "Delete", "Enter", "Process"].includes(event.key) || event.keyCode === 229);

/** `take` is called with a proposal's id when the person starts changing a block it touches: the screen takes it first. */
export const ProposalMarks = Extension.create<{ take: (id: string) => void }>({
	name: "montiProposalMarks",
	addOptions: () => ({ take: () => {} }),
	addProseMirrorPlugins() {
		const { take } = this.options;
		const takeAtCaret = (view: EditorView) => {
			const item = proposalAtCaret(view.state);
			if (item) take(item.id);
			return false;
		};
		return [
			new Plugin<State>({
				key: proposalMarksKey,
				state: {
					init: () => ({ items: [], current: null }),
					apply: (tr, value) => (tr.getMeta(proposalMarksKey) as State | undefined) ?? value,
				},
				props: {
					decorations: (state) => {
						const shown = proposalMarksKey.getState(state);
						if (!shown?.items.length) return null;
						const decorations: Decoration[] = [];
						for (const item of shown.items) {
							const drawn = draw(state.doc, item, item.id === shown.current);
							if (!drawn) continue;
							decorations.push(...drawn.decorations);
							// The proposal looked at: the blue line in the margin of each block it touches.
							if (item.id === shown.current)
								for (const block of drawn.blocks.filter((each) => !each.scrollOnly))
									decorations.push(Decoration.node(block.pos, block.end, { class: PROPOSAL_MARK_CLASSES.current }));
						}
						return DecorationSet.create(state.doc, decorations);
					},
					// Changing a block a proposal touches takes the proposal first, then the change goes over it.
					handleKeyDown: (view, event) => (changes(event) ? takeAtCaret(view) : false),
					handlePaste: (view) => takeAtCaret(view),
				},
			}),
		];
	},
});
