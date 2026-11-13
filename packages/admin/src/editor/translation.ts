import { type Block, type Doc, newBlockId, plainText, type TranslationLink } from "@monti-cms/core";
import { Extension } from "@tiptap/core";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Catalog } from "./catalog";
import { filledBlocks } from "./proposal-marks";

/** A top-level block's translation link, when it has one (doc 04). */
export const linkOf = (node: EditorNode): TranslationLink | null => (node.attrs.link as TranslationLink | null) ?? null;

/**
 * An undecided block as the editor holds it (doc 04, translation.md): empty, the source's words only its placeholder, so typing starts the block's own
 * words and none of the source's are left to delete. The stored block keeps the source's words (the site leaves it out; "Keep source" keeps them, an
 * assistant translates them): `pendingAsPlaceholders` empties each text of the undecided blocks and remembers the blocks, `restorePending` puts back a
 * block nobody wrote in, so the save stores it as it was.
 */
/** A source block new since the translation (an "added" mark): it shows as an undecided block after `after` (`null`: first). */
export type AddedBlock = { from: string; after: string | null; block: Block };

/**
 * `originals` holds each undecided block as it came: a stored one (put back while nobody wrote in it), or `null` for one the editor made for a block
 * new in the source (left out while nobody wrote in it: the core keeps it as a mark, not in the body, until it is decided).
 */
export type Placeholders = { doc: Doc; texts: Map<string, string>; originals: Map<string, Block | null> };

export function pendingAsPlaceholders(doc: Doc, kit: Catalog, added: AddedBlock[] = []): Placeholders {
	const byType = new Map(kit.blocks.map((block) => [block.type, block]));
	const texts = new Map<string, string>();
	const originals = new Map<string, Block | null>();
	/** The block with each of its texts emptied, the words kept as that text's placeholder. A block without text (an image, a table) stays as it is. */
	const emptied = (block: Block): Block => {
		const holds = byType.get(block.type)?.holds;
		if (holds === "text") {
			texts.set(block.id, plainText(block.content));
			const { content: _words, ...rest } = block;
			return rest;
		}
		if (holds === "blocks" && block.children) return { ...block, children: block.children.map(emptied) };
		return block;
	};
	const blocks = doc.blocks.map((block) => {
		if (block.link?.state !== "pending") return block;
		originals.set(block.id, block);
		return emptied(block);
	});
	// A block new in the source comes in as one more undecided block, paired with it (a save that keeps it written pairs it in the core).
	const made = (from: Block): Block => {
		const { id: _id, link: _link, ...words } = from;
		const block = emptied({ ...words, id: newBlockId(), link: { from: from.id, seen: "", state: "pending" } });
		originals.set(block.id, null);
		return block;
	};
	// One the body already pairs with (written in before the editor was made again, not saved yet) is not made twice.
	const paired = new Set(doc.blocks.flatMap((block) => (block.link ? [block.link.from] : [])));
	const fresh = added.filter((one) => !paired.has(one.from));
	for (const each of fresh.filter((one) => one.after === null).reverse()) blocks.unshift(made(each.block));
	for (const each of fresh.filter((one) => one.after !== null)) {
		const at = blocks.findIndex((block) => block.id === each.after);
		blocks.splice(at < 0 ? blocks.length : at + 1, 0, made(each.block));
	}
	return { doc: { ...doc, blocks }, texts, originals };
}

/**
 * The body to store: each block still undecided (nobody wrote in it) back in the source's words it came with, and one made for a block new in the
 * source left out.
 */
export const restorePending = (doc: Doc, originals: Map<string, Block | null>): Doc =>
	originals.size === 0
		? doc
		: {
				...doc,
				blocks: doc.blocks.flatMap((block) => {
					if (block.link?.state !== "pending" || !originals.has(block.id)) return [block];
					const original = originals.get(block.id);
					return original ? [original] : [];
				}),
			};

/** A source block as a side-by-side row shows it: its look, and its words with the ones that changed since the translation marked. */
export type PairedSourceBlock = { look: "heading" | "code" | "text"; parts: { text: string; changed: boolean }[] };

/**
 * What the side-by-side rows show beside the translation's blocks (translation.md, side by side): the source blocks by id, each translation block's
 * kind and its note ("Changed", "Removed"), and the source blocks new since the translation, each a row after the block it follows (`null`: first).
 */
export type PairedRows = {
	source: Map<string, PairedSourceBlock>;
	/** The kind of a block by its editor node's name. */
	kinds: Map<string, string>;
	/** A block's note by its id ("Changed", "Removed"), or by its source block's id for a block new in the source ("New"), in its color. */
	notes: Map<string, { text: string; tone: "warning" | "danger" | "success" }>;
};

const pairedKey = new PluginKey<PairedRows | null>("montiTranslationPaired");

/** Lays the text out as rows beside the source (`null`: the text alone). */
export const showPaired = (state: EditorState, rows: PairedRows | null) =>
	state.tr.setMeta(pairedKey, rows).setMeta("addToHistory", false);

/** A cell of a side-by-side row the editor does not edit. */
function cell(kind: "rule" | "kind" | "source", fill?: (element: HTMLElement) => void) {
	const element = document.createElement("div");
	element.setAttribute("data-pair", kind);
	element.contentEditable = "false";
	fill?.(element);
	return element;
}

/**
 * What ends the rows when the last block is one thing (a picture, a file): an empty picture that takes no room. Chrome moves the selection of such a block to
 * the first place that takes a caret as soon as the mouse moves when no such place comes after the block, and the source cell before it is text
 * that can be picked, so nothing before it counts either (T134).
 */
function endOfRows() {
	const element = document.createElement("img");
	element.setAttribute("data-pair", "end");
	element.alt = "";
	return element;
}

function sourceWords(element: HTMLElement, block: PairedSourceBlock | undefined) {
	if (!block) return;
	const holder = document.createElement("div");
	if (block.look === "heading") holder.setAttribute("data-pair-heading", "");
	if (block.look === "code") holder.setAttribute("data-pair-code", "");
	for (const part of block.parts) {
		const run = document.createElement(part.changed ? "mark" : "span");
		run.textContent = part.text;
		holder.append(run);
	}
	element.append(holder);
}

function kindCell(kind: string, note: { text: string; tone: string } | undefined) {
	return cell("kind", (element) => {
		element.append(kind);
		if (note) {
			const noted = document.createElement("span");
			noted.setAttribute("data-pair-note", note.tone);
			noted.textContent = note.text;
			element.append(noted);
		}
	});
}

const wordsKey = (block: PairedSourceBlock | undefined) =>
	block ? `${block.look}:${block.parts.map((part) => `${part.changed ? "+" : ""}${part.text}`).join("|")}` : "";

/** The rows beside the blocks: before each block its rule, kind and source. */
const PairedRowsPlugin = new Plugin<PairedRows | null>({
	key: pairedKey,
	state: {
		init: () => null,
		apply: (tr, rows) => {
			const meta = tr.getMeta(pairedKey) as PairedRows | null | undefined;
			return meta === undefined ? rows : meta;
		},
	},
	props: {
		decorations(state) {
			const rows = pairedKey.getState(state);
			if (!rows) return null;
			const shown: Decoration[] = [];
			const widget = (at: number, side: number, key: string, make: () => HTMLElement) =>
				shown.push(Decoration.widget(at, make, { side, key, ignoreSelection: true, stopEvent: () => true }));
			const { $from } = state.selection;
			const current = $from.depth >= 1 ? $from.before(1) : null;
			state.doc.forEach((node, pos) => {
				const id = String(node.attrs.blockId ?? "");
				const from = linkOf(node)?.from;
				const source = from ? rows.source.get(from) : undefined;
				const kind = rows.kinds.get(node.type.name) ?? "";
				const note = rows.notes.get(id) ?? (from ? rows.notes.get(from) : undefined);
				widget(pos, -3, `rule:${id}`, () => cell("rule"));
				widget(pos, -2, `kind:${id}:${kind}:${note ? `${note.tone}:${note.text}` : ""}`, () => kindCell(kind, note));
				widget(pos, -1, `source:${id}:${wordsKey(source)}`, () =>
					cell("source", (element) => sourceWords(element, source)),
				);
				if (pos === current) shown.push(Decoration.node(pos, pos + node.nodeSize, { "data-pair-current": "" }));
			});
			if (state.doc.lastChild?.isAtom) widget(state.doc.content.size, 1, "end", endOfRows);
			return DecorationSet.create(state.doc, shown);
		},
	},
});

const placeholdersKey = new PluginKey<Map<string, string>>("montiTranslationPlaceholders");

/** Gives the editor the source's words of the undecided blocks' texts, by block id, to show as their placeholders. */
export const showPlaceholders = (state: EditorState, texts: Map<string, string>) =>
	state.tr.setMeta(placeholdersKey, texts).setMeta("addToHistory", false);

/** The source block paired with the top-level block the cursor is in, if it has one. */
export function pairedSource(state: EditorState): string | null {
	const { $from } = state.selection;
	const top = $from.depth >= 1 ? $from.node(1) : null;
	return top ? (linkOf(top)?.from ?? null) : null;
}

/** Whether the top-level block at `pos` is undecided. */
const pendingAt = (state: EditorState, pos: number) => {
	const $pos = state.doc.resolve(pos);
	const top = $pos.depth >= 1 ? $pos.node(1) : null;
	return top ? linkOf(top)?.state === "pending" : false;
};

export const TranslationBlocks = Extension.create({
	name: "montiTranslationBlocks",
	// Before the editor's own keys: Backspace at the start of an empty heading would otherwise turn it into a paragraph first, dropping its link.
	priority: 1000,
	addKeyboardShortcuts() {
		// An undecided block looks empty but is paired with the source: Backspace at its start, or Delete at the end of the block before it, would take
		// it away (the source block would not be offered again). The cursor moves instead; the block menu's "Remove" removes it.
		return {
			Backspace: ({ editor }) => {
				const { selection } = editor.state;
				const { $from } = selection;
				if (!selection.empty || $from.depth !== 1 || $from.parentOffset !== 0 || $from.parent.content.size !== 0)
					return false;
				if (!pendingAt(editor.state, selection.from)) return false;
				const before = TextSelection.findFrom(editor.state.doc.resolve($from.before(1)), -1, true);
				if (before) editor.view.dispatch(editor.state.tr.setSelection(before).scrollIntoView());
				return true;
			},
			Delete: ({ editor }) => {
				const { selection } = editor.state;
				const { $from } = selection;
				if (!selection.empty || $from.parentOffset !== $from.parent.content.size || $from.depth < 1) return false;
				const after = $from.after(1);
				if (after >= editor.state.doc.content.size) return false;
				const next = editor.state.doc.resolve(after).nodeAfter;
				if (!next || linkOf(next)?.state !== "pending") return false;
				const into = TextSelection.findFrom(editor.state.doc.resolve(after), 1, true);
				if (into) editor.view.dispatch(editor.state.tr.setSelection(into).scrollIntoView());
				return true;
			},
		};
	},
	addProseMirrorPlugins() {
		const { editor } = this;
		/**
		 * Translated, as the core makes it on save: an undecided block once something is written in it (its texts were emptied for their placeholders), a
		 * block that follows the source (or an undecided one without text, an image) once its content changed from `before`.
		 */
		const settle = (after: EditorState, before: EditorState | null) => {
			const texts = placeholdersKey.getState(after) ?? new Map<string, string>();
			const old = new Map<string, EditorNode>();
			before?.doc.forEach((node) => {
				if (node.attrs.blockId) old.set(String(node.attrs.blockId), node);
			});
			const tr = after.tr;
			after.doc.forEach((node, pos) => {
				const link = linkOf(node);
				if (!link || (link.state !== "pending" && link.state !== "followSource")) return;
				let emptied = link.state === "pending" && texts.has(String(node.attrs.blockId));
				node.descendants((child) => {
					if (link.state === "pending" && texts.has(String(child.attrs.blockId))) emptied = true;
				});
				const was = old.get(String(node.attrs.blockId));
				const written = emptied ? node.textContent !== "" : Boolean(was && !was.content.eq(node.content));
				if (written) tr.setNodeAttribute(pos, "link", { ...link, state: "translated" } satisfies TranslationLink);
			});
			return tr.docChanged ? tr.setMeta("addToHistory", false) : null;
		};
		return [
			PairedRowsPlugin,
			new Plugin<Map<string, string>>({
				key: placeholdersKey,
				state: {
					init: () => new Map(),
					apply: (tr, texts) => tr.getMeta(placeholdersKey) ?? texts,
				},
				props: {
					// Each empty text of an undecided block shows the source's words it stands for, in the faint ink, where its own words will go.
					decorations(state) {
						const texts = placeholdersKey.getState(state);
						if (!texts || texts.size === 0) return null;
						const shown: Decoration[] = [];
						// A block the assistant proposed a translation for shows the proposal's words where the source's stood.
						const filled = filledBlocks(state);
						state.doc.forEach((top, at) => {
							if (linkOf(top)?.state !== "pending") return;
							const visit = (node: EditorNode, pos: number) => {
								const text =
									node.isTextblock && node.content.size === 0 && !filled.has(pos)
										? texts.get(String(node.attrs.blockId))
										: undefined;
								if (text) shown.push(Decoration.node(pos, pos + node.nodeSize, { "data-source-placeholder": text }));
							};
							visit(top, at);
							top.descendants((node, pos) => visit(node, at + 1 + pos));
						});
						return DecorationSet.create(state.doc, shown);
					},
				},
			}),
			new Plugin({
				key: new PluginKey("montiTranslationBlocks"),
				appendTransaction(transactions, before, after) {
					if (!transactions.some((tr) => tr.docChanged)) return null;
					// A block's state changes only once a syllable is done: a node changing while Korean or Japanese is composed in it would break the
					// composition (the first jamo would stay behind on its own). `compositionend` settles it.
					if (editor.view?.composing) return null;
					return settle(after, before);
				},
				props: {
					handleDOMEvents: {
						compositionend: (view) => {
							setTimeout(() => {
								if (view.isDestroyed || view.composing) return;
								const tr = settle(view.state, null);
								if (tr) view.dispatch(tr);
							});
							return false;
						},
					},
					decorations(state) {
						const marks: Decoration[] = [];
						state.doc.forEach((node, pos) => {
							if (linkOf(node)?.state === "pending")
								marks.push(Decoration.node(pos, pos + node.nodeSize, { "data-untranslated": "" }));
						});
						return DecorationSet.create(state.doc, marks);
					},
				},
			}),
		];
	},
});
