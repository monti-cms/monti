import { type Block, type Doc, plainText, type TranslationLink } from "@monti-cms/core";
import { Extension } from "@tiptap/core";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Catalog } from "./catalog";

/** A top-level block's translation link, when it has one (doc 04). */
export const linkOf = (node: EditorNode): TranslationLink | null => (node.attrs.link as TranslationLink | null) ?? null;

/**
 * An undecided block as the editor holds it (doc 04, translation.md): empty, the source's words only its placeholder, so typing starts the block's own
 * words and none of the source's are left to delete. The stored block keeps the source's words (the site leaves it out; "Keep source" keeps them, an
 * assistant translates them): `pendingAsPlaceholders` empties each text of the undecided blocks and remembers the blocks, `restorePending` puts back a
 * block nobody wrote in, so the save stores it as it was.
 */
export type Placeholders = { doc: Doc; texts: Map<string, string>; originals: Map<string, Block> };

export function pendingAsPlaceholders(doc: Doc, kit: Catalog): Placeholders {
	const byType = new Map(kit.blocks.map((block) => [block.type, block]));
	const texts = new Map<string, string>();
	const originals = new Map<string, Block>();
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
	return { doc: { ...doc, blocks }, texts, originals };
}

/** The body to store: each block still undecided (nobody wrote in it) back in the source's words it came with. */
export const restorePending = (doc: Doc, originals: Map<string, Block>): Doc =>
	originals.size === 0
		? doc
		: {
				...doc,
				blocks: doc.blocks.map((block) =>
					block.link?.state === "pending" ? (originals.get(block.id) ?? block) : block,
				),
			};

/** A source block as a side-by-side row shows it: its look, and its words with the ones that changed since the translation marked. */
export type PairedSourceBlock = { look: "heading" | "code" | "text"; parts: { text: string; changed: boolean }[] };

/**
 * What the side-by-side rows show beside the translation's blocks (translation.md, side by side): the source blocks by id, each translation block's
 * kind and its note ("Changed", "Removed"), and the source blocks new since the translation, each a row after the block it follows (`null`: first).
 */
export type PairedRows = {
	source: Map<string, PairedSourceBlock>;
	kinds: Map<string, string>;
	notes: Map<string, string>;
	added: { key: string; after: string | null; kind: string; note: string; block: PairedSourceBlock }[];
};

const pairedKey = new PluginKey<PairedRows | null>("montiTranslationPaired");

/** Lays the text out as rows beside the source (`null`: the text alone). */
export const showPaired = (state: EditorState, rows: PairedRows | null) =>
	state.tr.setMeta(pairedKey, rows).setMeta("addToHistory", false);

/** A cell of a side-by-side row the editor does not edit. */
function cell(kind: "rule" | "kind" | "source" | "ghost", fill?: (element: HTMLElement) => void) {
	const element = document.createElement("div");
	element.setAttribute("data-pair", kind);
	element.contentEditable = "false";
	fill?.(element);
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

function kindCell(kind: string, note: string | undefined) {
	return cell("kind", (element) => {
		element.append(kind);
		if (note) {
			const noted = document.createElement("span");
			noted.setAttribute("data-pair-note", "");
			noted.textContent = note;
			element.append(noted);
		}
	});
}

const wordsKey = (block: PairedSourceBlock | undefined) =>
	block ? `${block.look}:${block.parts.map((part) => `${part.changed ? "+" : ""}${part.text}`).join("|")}` : "";

/** The rows beside the blocks: before each block its rule, kind and source; after the block a new source block follows, its row with a faint line. */
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
			const addedAfter = (after: string | null, at: number) =>
				rows.added
					.filter((row) => row.after === after)
					.forEach((row, index) => {
						const side = -1000 + index * 4;
						const key = `${row.key}:${wordsKey(row.block)}`;
						widget(at, side, `rule:${key}`, () => cell("rule"));
						widget(at, side + 1, `kind:${key}`, () => kindCell(row.kind, row.note));
						widget(at, side + 2, `source:${key}`, () => cell("source", (element) => sourceWords(element, row.block)));
						widget(at, side + 3, `ghost:${key}`, () =>
							cell("ghost", (element) => {
								element.textContent = row.block.parts.map((part) => part.text).join("");
							}),
						);
					});
			addedAfter(null, 0);
			const { $from } = state.selection;
			const current = $from.depth >= 1 ? $from.before(1) : null;
			state.doc.forEach((node, pos) => {
				const id = String(node.attrs.blockId ?? "");
				const from = linkOf(node)?.from;
				const source = from ? rows.source.get(from) : undefined;
				const kind = rows.kinds.get(id) ?? "";
				const note = rows.notes.get(id);
				widget(pos, -3, `rule:${id}`, () => cell("rule"));
				widget(pos, -2, `kind:${id}:${kind}:${note ?? ""}`, () => kindCell(kind, note));
				widget(pos, -1, `source:${id}:${wordsKey(source)}`, () =>
					cell("source", (element) => sourceWords(element, source)),
				);
				if (pos === current) shown.push(Decoration.node(pos, pos + node.nodeSize, { "data-pair-current": "" }));
				addedAfter(id, pos + node.nodeSize);
			});
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

/** A source block new since the translation, shown where it would go: after a block (`null`: first), in the dimmed look. */
export type Ghost = { key: string; after: string | null; text: string };

const ghostsKey = new PluginKey<Ghost[]>("montiTranslationGhosts");

/** Shows these new source blocks as dimmed lines, not part of the text (they come in only when the person brings them in). */
export const showGhosts = (state: EditorState, ghosts: Ghost[]) =>
	state.tr.setMeta(ghostsKey, ghosts).setMeta("addToHistory", false);

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
						state.doc.forEach((top, at) => {
							if (linkOf(top)?.state !== "pending") return;
							const visit = (node: EditorNode, pos: number) => {
								const text =
									node.isTextblock && node.content.size === 0 ? texts.get(String(node.attrs.blockId)) : undefined;
								if (text) shown.push(Decoration.node(pos, pos + node.nodeSize, { "data-source-placeholder": text }));
							};
							visit(top, at);
							top.descendants((node, pos) => visit(node, at + 1 + pos));
						});
						return DecorationSet.create(state.doc, shown);
					},
				},
			}),
			new Plugin<Ghost[]>({
				key: ghostsKey,
				state: {
					init: () => [],
					apply: (tr, ghosts) => tr.getMeta(ghostsKey) ?? ghosts,
				},
				props: {
					decorations(state) {
						const ghosts = ghostsKey.getState(state) ?? [];
						if (ghosts.length === 0) return null;
						const ends = new Map<string, number>();
						state.doc.forEach((node, pos) => {
							if (node.attrs.blockId) ends.set(String(node.attrs.blockId), pos + node.nodeSize);
						});
						return DecorationSet.create(
							state.doc,
							ghosts.flatMap((ghost) => {
								const at = ghost.after === null ? 0 : ends.get(ghost.after);
								if (at === undefined) return [];
								const line = () => {
									const element = document.createElement("p");
									element.setAttribute("data-untranslated", "");
									element.setAttribute("data-ghost", ghost.key);
									element.contentEditable = "false";
									element.textContent = ghost.text;
									return element;
								};
								return [Decoration.widget(at, line, { key: `ghost:${ghost.key}:${ghost.text}`, side: -1 })];
							}),
						);
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
