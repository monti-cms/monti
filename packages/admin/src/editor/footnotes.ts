import { Extension } from "@tiptap/core";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey, TextSelection, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { nodeName } from "./schema";

/**
 * Footnotes in the body (T62, editor-tools.md, footnotes). A reference in the text (`footnoteRef`) points at a footnote block by the footnote's id. The
 * footnotes always sit together at the end of the body, numbered in the order their references come in the text. Taking out a footnote's last
 * reference takes the footnote out with it, and taking out a footnote takes out its references; both come back together with ⌘Z.
 */

const FOOTNOTE = nodeName("footnote");
const REF = "footnoteRef";
const key = new PluginKey("montiFootnotes");

const footnoteId = (node: EditorNode) => String(node.attrs.data?.id ?? "");

/** The references' ids in the order they come in the text (a footnote's own text is not the text), each once. */
function referenced(doc: EditorNode): string[] {
	const ids: string[] = [];
	doc.forEach((block) => {
		if (block.type.name === FOOTNOTE) return;
		block.descendants((node) => {
			if (node.type.name === REF && !ids.includes(String(node.attrs.id))) ids.push(String(node.attrs.id));
		});
	});
	return ids;
}

/** The footnote blocks at the top of the body, with where they are. */
function footnotes(doc: EditorNode): { pos: number; node: EditorNode; id: string }[] {
	const found: { pos: number; node: EditorNode; id: string }[] = [];
	doc.forEach((node, pos) => {
		if (node.type.name === FOOTNOTE) found.push({ pos, node, id: footnoteId(node) });
	});
	return found;
}

/** Each referenced footnote's number. */
export function footnoteNumbers(doc: EditorNode): Map<string, number> {
	return new Map(referenced(doc).map((id, at) => [id, at + 1]));
}

/**
 * Puts the footnotes together at the end, in the order of their numbers (one nothing points at goes last). Does nothing when they are already so,
 * so the caret in a footnote stays where it is.
 */
export function orderFootnotes(tr: Transaction) {
	const numbers = footnoteNumbers(tr.doc);
	const notes = footnotes(tr.doc);
	if (notes.length === 0) return tr;
	const rank = (id: string) => numbers.get(id) ?? Number.POSITIVE_INFINITY;
	const wanted = [...notes].sort((a, b) => rank(a.id) - rank(b.id));
	const tail: EditorNode[] = [];
	tr.doc.forEach((node) => {
		tail.push(node);
	});
	const atEnd = tail.slice(-notes.length);
	if (wanted.every((note, at) => atEnd[at] === note.node)) return tr;
	// Copies go in at the end first, so the body is never empty on the way; then the old places go, from the last.
	tr.insert(
		tr.doc.content.size,
		wanted.map((note) => note.node),
	);
	for (const note of [...notes].reverse()) tr.delete(note.pos, note.pos + note.node.nodeSize);
	// The body keeps a line of its own before its footnotes.
	if (tr.doc.firstChild?.type.name === FOOTNOTE) tr.insert(0, tr.doc.type.schema.nodes.paragraph.create());
	return tr;
}

/** A new footnote's id: short, and not one the body has. */
function newFootnoteId(doc: EditorNode) {
	const taken = new Set(footnotes(doc).map((note) => note.id));
	let id = "";
	do id = `fn_${Math.random().toString(36).slice(2, 7)}`;
	while (taken.has(id));
	return id;
}

/** Puts a reference at `at` and an empty footnote for it at the end, and the caret in the footnote's text. */
export function insertFootnote(tr: Transaction, at: number) {
	const schema = tr.doc.type.schema;
	const type = schema.nodes[FOOTNOTE];
	const ref = schema.nodes[REF];
	if (!type || !ref) return false;
	const id = newFootnoteId(tr.doc);
	tr.insert(at, ref.create({ id }));
	tr.insert(tr.doc.content.size, type.create({ data: { id } }));
	orderFootnotes(tr);
	const note = footnotes(tr.doc).find((each) => each.id === id);
	if (note) tr.setSelection(TextSelection.create(tr.doc, note.pos + 1)).scrollIntoView();
	return true;
}

/** The caret to the end of a footnote's text, and the footnote into view. */
export function goToFootnote(state: EditorState, id: string): Transaction | null {
	const note = footnotes(state.doc).find((each) => each.id === id);
	if (!note) return null;
	return state.tr.setSelection(TextSelection.create(state.doc, note.pos + 1 + note.node.content.size)).scrollIntoView();
}

/** The caret to just after a footnote's first reference in the text. */
function backToReference(state: EditorState, id: string): Transaction | null {
	let at: number | null = null;
	state.doc.forEach((block, offset) => {
		if (at !== null || block.type.name === FOOTNOTE) return;
		block.descendants((node, pos) => {
			if (at === null && node.type.name === REF && String(node.attrs.id) === id) at = offset + 1 + pos + 1;
		});
	});
	return at === null ? null : state.tr.setSelection(TextSelection.create(state.doc, at)).scrollIntoView();
}

export const Footnotes = Extension.create({
	name: "montiFootnotes",
	addProseMirrorPlugins() {
		return [
			new Plugin({
				key,
				appendTransaction: (transactions, before, state) => {
					if (!transactions.some((each) => each.docChanged)) return null;
					const tr = state.tr;
					const wasReferenced = new Set(referenced(before.doc));
					const isReferenced = new Set(referenced(state.doc));
					const hadNotes = new Set(footnotes(before.doc).map((note) => note.id));
					const notes = footnotes(state.doc);
					const hasNotes = new Set(notes.map((note) => note.id));
					// A footnote whose last reference was just taken out goes with it.
					for (const note of [...notes].reverse())
						if (wasReferenced.has(note.id) && !isReferenced.has(note.id))
							tr.delete(note.pos, note.pos + note.node.nodeSize);
					// References to a footnote just taken out go with it.
					const orphans: { pos: number; size: number }[] = [];
					tr.doc.descendants((node, pos) => {
						const id = String(node.attrs.id ?? "");
						if (node.type.name === REF && hadNotes.has(id) && !hasNotes.has(id))
							orphans.push({ pos, size: node.nodeSize });
					});
					for (const orphan of orphans.reverse()) tr.delete(orphan.pos, orphan.pos + orphan.size);
					orderFootnotes(tr);
					return tr.docChanged ? tr : null;
				},
				props: {
					decorations: (state) => {
						const numbers = footnoteNumbers(state.doc);
						const decorations: Decoration[] = [];
						state.doc.descendants((node, pos) => {
							if (node.type.name === REF)
								decorations.push(
									Decoration.node(pos, pos + node.nodeSize, {
										"data-n": String(numbers.get(String(node.attrs.id)) ?? ""),
									}),
								);
						});
						footnotes(state.doc).forEach((note, at) => {
							decorations.push(
								Decoration.node(note.pos, note.pos + note.node.nodeSize, {
									"data-n": String(numbers.get(note.id) ?? ""),
									...(at === 0 ? { "data-footnotes-start": "" } : {}),
								}),
							);
						});
						return DecorationSet.create(state.doc, decorations);
					},
					handleClickOn: (view, _pos, node) => {
						// A reference's number goes to its footnote.
						if (node.type.name !== REF) return false;
						const tr = goToFootnote(view.state, String(node.attrs.id));
						if (tr) view.dispatch(tr);
						return Boolean(tr);
					},
					handleDOMEvents: {
						mousedown: (view, event) => {
							// A footnote's number (in its left margin) goes back to its reference.
							const target = event.target as HTMLElement | null;
							const block = target?.closest?.("[data-footnote]") as HTMLElement | null;
							if (!block || event.offsetX >= Number.parseFloat(getComputedStyle(block).paddingLeft)) return false;
							const tr = backToReference(view.state, block.dataset.footnote ?? "");
							if (!tr) return false;
							event.preventDefault();
							view.dispatch(tr);
							view.focus();
							return true;
						},
					},
					handleKeyDown: (view, event) => {
						// A footnote is one paragraph: Enter does not make another footnote.
						if (event.key !== "Enter" || event.shiftKey) return false;
						return view.state.selection.$from.parent.type.name === FOOTNOTE;
					},
				},
			}),
		];
	},
});
