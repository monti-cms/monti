import {
	applyOps,
	type Block,
	type BodyOp,
	canonical,
	type Doc,
	type Inline,
	type Mark,
	type NewBlock,
	plainText,
	sameJson,
	textToInline,
} from "@monti-cms/core";
import { PROPOSAL_MARK_CLASSES } from "@monti-cms/ui";
import { type Editor, Extension } from "@tiptap/core";
import type { Mark as EditorMark, Node as EditorNode, Schema } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { inlineDiff } from "../assistant/diff";
import type { Catalog } from "./catalog";
import { blockFromEditor, blockToEditor, docFromEditor, docToEditor } from "./convert";
import { KEPT_MARK, markName } from "./names";

/**
 * The assistant's body proposals drawn over the text (doc 03 principle 5, doc 05; T32). A proposal is a `body.edit` item: block operations that name
 * blocks by id. A block's new text (`setText`) is drawn word by word against the words it has now: words it takes out are blue and struck
 * through, words it puts in are on the pale blue ground, a block it removes is struck through whole,
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

/** The words of a textblock as the core's `plainText` reads them: a hard break is one character, a footnote's number none. */
function blockText(node: EditorNode) {
	let text = "";
	node.forEach((child) => {
		if (child.isText) text += child.text;
		else if (child.type.name === "hardBreak") text += "\n";
	});
	return text;
}

/** The editor position of an offset in a textblock's words (`blockText`), for drawing a word change where it stands. */
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

/** The attribute that says which proposal a drawn change is of: pressing it opens that change's card (AS-12). */
export const PROPOSAL_ITEM = "data-proposal-item";

const element = (tag: string, className: string, text: string, item: string) => {
	const node = document.createElement(tag);
	node.className = className;
	node.textContent = text;
	node.setAttribute(PROPOSAL_ITEM, item);
	return node;
};

/** A line put in: a block of its own with the inserted text on the pale blue ground. */
const insertedBlocks = (blocks: NewBlock[], current: boolean, item: string) => () => {
	const box = document.createElement("div");
	box.setAttribute("data-proposal-insert", "");
	box.setAttribute(PROPOSAL_ITEM, item);
	// The proposal looked at: its blue line is beside the new lines themselves.
	if (current) box.className = PROPOSAL_MARK_CLASSES.current;
	for (const block of blocks) {
		const line = document.createElement("p");
		line.append(element("ins", PROPOSAL_MARK_CLASSES.ins, newText(block), item));
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

type SetText = Extract<BodyOp, { op: "setText" }>;

/** The words a block's new text holds, without its tags; a code block's text is its code. `null` when the tags do not read. */
function newWords(op: SetText, node: EditorNode): string | null {
	if (node.type.name === "codeBlock") return op.text;
	try {
		return plainText(textToInline(op.text));
	} catch {
		return null;
	}
}

/** A mark as one comparable word: its editor name and its stored attrs (a link keeps only its address, as `docFromEditor` stores it). */
const markKey = (name: string, attrs: Record<string, unknown>) =>
	`${name}${JSON.stringify(canonical(name === markName("link") ? { href: attrs.href } : Object.fromEntries(Object.entries(attrs).filter(([, value]) => value !== null && value !== undefined))))}`;
const storedKey = ({ type, ...attrs }: Mark) => markKey(markName(type), attrs);
const editorKey = (mark: EditorMark): string =>
	mark.type.name === KEPT_MARK ? storedKey(mark.attrs.mark as Mark) : markKey(mark.type.name, mark.attrs);

/** Each letter's marks, in `blockText` offsets: a hard break is a letter with none, a footnote's number no letter. */
function editorMarks(node: EditorNode): string[] {
	const out: string[] = [];
	node.forEach((child) => {
		if (child.isText)
			out.push(...Array<string>(child.text?.length ?? 0).fill(child.marks.map(editorKey).sort().join(" ")));
		else if (child.type.name === "hardBreak") out.push("");
	});
	return out;
}
function storedMarks(content: Inline[]): string[] {
	const out: string[] = [];
	for (const inline of content)
		if (inline.type === "text")
			out.push(...Array<string>(inline.text.length).fill((inline.marks ?? []).map(storedKey).sort().join(" ")));
		else if (inline.type === "hardBreak") out.push("");
	return out;
}

/** Whether an op is the last `setText` of its block in the proposal: the block ends with that text, so only it is drawn. */
const lastText = (item: BodyProposal, op: SetText) =>
	item.ops.findLast((each) => each.op === "setText" && each.block === op.block) === op;

/** One proposal's marks, or `null` when what it points at is not there as it expects (stale). */
function draw(doc: EditorNode, item: BodyProposal, current = false): Drawn | null {
	const decorations: Decoration[] = [];
	const blocks: Drawn["blocks"] = [];
	const touch = (pos: number, node: EditorNode) => blocks.push({ pos, end: pos + node.nodeSize });
	const owned = { [PROPOSAL_ITEM]: item.id };
	// The blocks it changes hold the words it was made on: a change drawn against other words would strike the wrong ones.
	for (const op of item.ops)
		for (const id of op.op === "remove" ? op.blocks : op.op === "insert" ? [] : [op.block]) {
			const found = findBlock(doc, id);
			if (found && !emptied(doc, found) && !asItWas(item, id, found.node)) return null;
		}
	for (const [at, op] of item.ops.entries()) {
		// A widget is kept by its key: a change made again at its place (the same item, other words) must be drawn anew.
		const key = `${item.id}:${at}:${current}:${JSON.stringify(op)}`;
		switch (op.op) {
			case "setText": {
				const found = findBlock(doc, op.block);
				if (!found?.node.isTextblock) return null;
				const words = newWords(op, found.node);
				if (words === null) return null;
				if (!lastText(item, op)) break;
				// An undecided block of a translation: the words that fill it, in blue, where its own words will stand.
				if (emptied(doc, found)) {
					decorations.push(
						Decoration.widget(found.pos + 1, () => element("span", FILL, words, item.id), { side: 1, key }),
						Decoration.node(found.pos, found.pos + found.node.nodeSize, { "data-proposal-fill": "", ...owned }),
					);
					touch(found.pos, found.node);
					break;
				}
				// Word by word against the words the block has now: what goes out struck through where it stands, what comes in beside it, and
				// words that stay but change their formatting on the ground of words put in.
				const before = editorMarks(found.node);
				const after = found.node.type.name === "codeBlock" ? null : storedMarks(textToInline(op.text));
				const restyled = (from: number, to: number) =>
					decorations.push(
						Decoration.inline(textPos(found.node, found.pos, from), textPos(found.node, found.pos, to), {
							class: PROPOSAL_MARK_CLASSES.ins,
							...owned,
						}),
					);
				let offset = 0;
				let added = 0;
				for (const [index, run] of inlineDiff(blockText(found.node), words).entries()) {
					const at = textPos(found.node, found.pos, offset);
					if (run.kind === "ins") {
						decorations.push(
							Decoration.widget(at, () => element("ins", PROPOSAL_MARK_CLASSES.ins, run.text, item.id), {
								side: 1,
								key: `${key}:${index}`,
							}),
						);
						added += run.text.length;
						continue;
					}
					if (run.kind === "del") {
						decorations.push(
							Decoration.inline(at, textPos(found.node, found.pos, offset + run.text.length), {
								class: PROPOSAL_MARK_CLASSES.del,
								...owned,
							}),
						);
						offset += run.text.length;
						continue;
					}
					let changed: number | null = null;
					for (let letter = 0; letter < run.text.length; letter++) {
						const differs = after !== null && before[offset + letter] !== after[added + letter];
						if (differs && changed === null) changed = offset + letter;
						if (!differs && changed !== null) {
							restyled(changed, offset + letter);
							changed = null;
						}
					}
					if (changed !== null) restyled(changed, offset + run.text.length);
					offset += run.text.length;
					added += run.text.length;
				}
				touch(found.pos, found.node);
				break;
			}
			case "remove":
				for (const id of op.blocks) {
					const found = findBlock(doc, id);
					if (!found) return null;
					decorations.push(
						Decoration.node(found.pos, found.pos + found.node.nodeSize, { class: PROPOSAL_MARK_CLASSES.del, ...owned }),
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
						Decoration.widget(found.pos + 1, () => element("span", FILL, words, item.id), { side: 1, key }),
						Decoration.node(found.pos, end, { "data-proposal-fill": "", ...owned }),
					);
					touch(found.pos, found.node);
					break;
				}
				decorations.push(Decoration.node(found.pos, end, { class: PROPOSAL_MARK_CLASSES.del, ...owned }));
				touch(found.pos, found.node);
				if (op.op === "setBlock") {
					decorations.push(Decoration.widget(end, insertedBlocks([op.value], current, item.id), { side: 1, key }));
					break;
				}
				const after = op.after === null ? null : findBlock(doc, op.after);
				if (op.after !== null && !after) return null;
				const place = after ? after.pos + after.node.nodeSize : 0;
				const moved: NewBlock = {
					type: found.node.type.name,
					content: [{ type: "text", text: found.node.textContent }],
				};
				decorations.push(Decoration.widget(place, insertedBlocks([moved], current, item.id), { side: 1, key }));
				break;
			}
			case "insert": {
				const after = op.after === null ? null : findBlock(doc, op.after);
				if (op.after !== null && !after) return null;
				const place = after ? after.pos + after.node.nodeSize : 0;
				decorations.push(Decoration.widget(place, insertedBlocks(op.blocks, current, item.id), { side: 1, key }));
				// Scrolled to by the block it goes after; its blue line is on the new lines.
				if (after) blocks.push({ pos: after.pos, end: after.pos + after.node.nodeSize, scrollOnly: true });
				break;
			}
		}
	}
	return { decorations, blocks };
}

/** One proposal's marks over this body, or `null` when it is stale: what the editor draws for it. */
export const proposalDecorations = (doc: EditorNode, item: BodyProposal): Decoration[] | null =>
	draw(doc, item)?.decorations ?? null;

/** The undecided blocks of a translation that a drawn proposal fills: their placeholder (the source's words) gives way to the proposal's. */
export function filledBlocks(state: EditorState): Set<number> {
	const shown = proposalMarksKey.getState(state);
	const filled = new Set<number>();
	for (const item of shown?.items ?? []) {
		if (draw(state.doc, item) === null) continue;
		for (const op of item.ops) {
			if (op.op !== "setText" && op.op !== "setBlock") continue;
			const found = findBlock(state.doc, op.block);
			if (found && emptied(state.doc, found)) filled.add(found.pos);
		}
	}
	return filled;
}

/** The proposals that can be drawn on this body now, in order: the bubble walks these. */
export const drawable = <T extends BodyProposal>(doc: EditorNode, items: T[]): T[] =>
	items.filter((item) => proposalDecorations(doc, item) !== null);

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
 * The block a proposal drawn on the body hangs beside: the first it names, or for lines put in at the very start, the body's first block
 * (the new lines stand above it). `null`: nothing to hang it on.
 */
export function drawnAnchor(doc: EditorNode, item: BodyProposal): string | null {
	const named = anchorBlock(doc, item);
	if (named !== null || !item.ops.some((op) => op.op === "insert" && op.after === null)) return named;
	let first: string | null = null;
	doc.descendants((node) => {
		if (first !== null) return false;
		if (node.isBlock && typeof node.attrs.blockId === "string") {
			first = node.attrs.blockId;
			return false;
		}
	});
	return first;
}

/**
 * The proposals that cannot be drawn on this body any more and still have a block to hang beside (T87), each with that block and the words
 * it would have put there: the text moved on since they were made. One whose blocks are all gone has no place in the editor; it waits on its
 * conversation's card.
 */
export const staleProposals = <T extends BodyProposal>(
	doc: EditorNode,
	items: T[],
): { item: T; block: string; words: string | null }[] =>
	items.flatMap((item) => {
		if (draw(doc, item) !== null) return [];
		const block = anchorBlock(doc, item);
		return block === null ? [] : [{ item, block, words: proposedWords(doc, item, block) }];
	});

/** What a stale proposal would have put in its block's place: the words of its new text, or none when it takes the block out. */
function proposedWords(doc: EditorNode, item: BodyProposal, block: string): string | null {
	const was = item.was?.[block];
	const found = findBlock(doc, block);
	const texts = item.ops.filter((op): op is SetText => op.op === "setText" && op.block === block);
	// The block ends with its last new text.
	const last = texts.at(-1);
	if (last) return found ? (newWords(last, found.node) ?? last.text) : last.text;
	for (const op of item.ops) {
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
export type Convert = {
	toEditor: (doc: Doc) => EditorNode;
	fromEditor: (node: EditorNode) => Doc;
	/** One block each way, with nothing of the whole body's rules (an empty last paragraph is a body's, not a block's). */
	blockToEditor: (block: Block) => EditorNode;
	blockFromEditor: (node: EditorNode) => Block;
};

/** The editor's own way between its body and a stored one (`docToEditor`, `docFromEditor`). */
export const convertFor = (schema: Schema, kit: Catalog): Convert => ({
	toEditor: (doc) => schema.nodeFromJSON(docToEditor(doc, kit)),
	fromEditor: (node) => docFromEditor(node.toJSON(), kit),
	blockToEditor: (block) => schema.nodeFromJSON(blockToEditor(block, kit)),
	blockFromEditor: (node) => blockFromEditor(node.toJSON(), kit),
});

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
 * A block's new text taken into the editor: the core makes the block's content (`applyOps`, so the marks are the core's reading of its tags), and
 * only the part of the editor's content that differs is replaced, so a caret in the words that stay stays put. The block itself and its attrs
 * (its id, a translation's link) stay; a code block's moved line effects come with the new code. An undecided translation block, empty in the
 * editor, takes the whole of it.
 */
function takeText(tr: Transaction, op: SetText, convert: Convert) {
	const found = findBlock(tr.doc, op.block);
	if (!found) return;
	// The block alone, not the whole body: an undecided translation block is empty in the editor, and a body's rules may drop an empty paragraph.
	const next = applyOps({ type: "doc", blocks: [convert.blockFromEditor(found.node)] }, [op]).blocks[0];
	if (!next) return;
	const made = convert.blockToEditor(next);
	const start = found.pos + 1;
	// Each changed run of words on its own, from the end: words that stay between two changes are not replaced, and a caret in them stays put.
	const spans: { a: number; aEnd: number; b: number; bEnd: number }[] = [];
	let a = 0;
	let b = 0;
	let open = false;
	for (const run of inlineDiff(blockText(found.node), blockText(made))) {
		if (run.kind === "same") {
			open = false;
			a += run.text.length;
			b += run.text.length;
			continue;
		}
		if (!open) spans.push({ a, aEnd: a, b, bEnd: b });
		open = true;
		const span = spans[spans.length - 1] as (typeof spans)[number];
		if (run.kind === "del") span.aEnd = a += run.text.length;
		else span.bEnd = b += run.text.length;
	}
	for (const span of spans.reverse())
		tr.replaceWith(
			textPos(found.node, found.pos, span.a),
			textPos(found.node, found.pos, span.aEnd),
			made.content.cut(textPos(made, -1, span.b), textPos(made, -1, span.bEnd)),
		);
	// What the words do not show (a mark put on or taken off words that stay) goes in as the one part that still differs.
	const now = tr.doc.nodeAt(found.pos);
	const from = now ? now.content.findDiffStart(made.content) : null;
	if (now && from !== null) {
		const ends = now.content.findDiffEnd(made.content);
		let endOld = ends?.a ?? now.content.size;
		let endNew = ends?.b ?? made.content.size;
		// Where the two ends overlap (a repeated letter), the change starts at `from` all the same.
		const overlap = from - Math.min(endOld, endNew);
		if (overlap > 0) {
			endOld += overlap;
			endNew += overlap;
		}
		tr.replaceWith(start + from, start + endOld, made.content.cut(from, endNew));
	}
	if ("data" in found.node.attrs && !sameJson(found.node.attrs.data, made.attrs.data))
		tr.setNodeMarkup(found.pos, undefined, { ...found.node.attrs, data: made.attrs.data });
}

/** The body proposals a body holds as taken (the document's `taken`): a take writes it in the same step as its words. */
export const takenIn = (doc: EditorNode): readonly string[] => (doc.attrs.taken as readonly string[] | undefined) ?? [];

/**
 * Takes a proposal into the body: a block's new text goes in where it differs, a block change replaces only the blocks it changes, and the
 * proposal is marked taken in the document itself. All in one transaction, so one undo takes back the words and the "taken" together (AS-19):
 * a "taken" kept beside the history stayed taken over the words the undo put back, and the save would have sent it as applied.
 */
export function takeProposal(state: EditorState, item: BodyProposal, convert: Convert): Transaction {
	const tr = state.tr;
	const taken = takenIn(state.doc);
	if (!taken.includes(item.id)) tr.setDocAttribute("taken", [...taken, item.id]);
	for (const op of item.ops) {
		if (op.op === "setText") {
			takeText(tr, op, convert);
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
	editor.view.dispatch(takeProposal(editor.state, item, convertFor(editor.schema, kit)));
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
