import { newBlockId } from "@monti-cms/core";
import { CHECK_MARK_PATH } from "@monti-cms/ui";
import { Extension } from "@tiptap/core";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { nodeName, UNKNOWN } from "./schema";

const blockIdsKey = new PluginKey("montiBlockIds");

/**
 * Block ids (doc 03, principle 2). A block keeps the id it was loaded with through edits and moves. After every change, a block without an id, or with
 * the id of a block before it (a split, a paste, a duplicate), gets a new one. A new empty list item does not inherit its neighbour's tick.
 */
export const BlockIds = Extension.create({
	name: "montiBlockIds",
	addProseMirrorPlugins() {
		const listItem = nodeName("listItem");
		return [
			new Plugin({
				key: blockIdsKey,
				appendTransaction: (transactions, _old, state) => {
					if (!transactions.some((transaction) => transaction.docChanged)) return null;
					const seen = new Set<string>();
					const missing: { pos: number; node: EditorNode }[] = [];
					state.doc.descendants((node, pos) => {
						if (!node.isBlock || !("blockId" in node.attrs)) return;
						const id = node.attrs.blockId;
						if (typeof id === "string" && id !== "" && !seen.has(id)) seen.add(id);
						else missing.push({ pos, node });
					});
					if (missing.length === 0) return null;
					const transaction = state.tr;
					for (const { pos, node } of missing) {
						let id = newBlockId();
						while (seen.has(id)) id = newBlockId();
						seen.add(id);
						transaction.setNodeAttribute(pos, "blockId", id);
						if (node.type.name === listItem && node.content.size === 0 && node.attrs.data?.checked)
							transaction.setNodeAttribute(pos, "data", null);
					}
					// Giving a block an id is not an edit of its own: it joins the change that made the block.
					return transaction.setMeta("addToHistory", false);
				},
			}),
		];
	},
});

const SVG = "http://www.w3.org/2000/svg";

/** Ticks or unticks the checklist item at `pos`. */
function toggleItem(view: EditorView, pos: number) {
	const node = view.state.doc.nodeAt(pos);
	if (!node) return;
	const { checked, ...rest } = (node.attrs.data ?? {}) as Record<string, unknown>;
	const next = checked ? (Object.keys(rest).length > 0 ? rest : null) : { ...rest, checked: true };
	view.dispatch(view.state.tr.setNodeAttribute(pos, "data", next));
}

/**
 * The box at a checklist item's start (`data-check`, drawn by `EditorBody`): its ✓ is always there, shown while the item is ticked. Where the text
 * is written it is a stop of the keyboard: Space ticks it, and the focus stays on it. A press with the main button ticks it too.
 */
function checkBox(
	view: EditorView,
	getPos: () => number | undefined,
	checked: boolean,
	label: string,
	editable: boolean,
) {
	const box = document.createElement("span");
	box.setAttribute("data-check", "");
	box.contentEditable = "false";
	box.setAttribute("role", "checkbox");
	box.setAttribute("aria-checked", String(checked));
	box.setAttribute("aria-label", label);
	if (editable) box.tabIndex = 0;
	const svg = document.createElementNS(SVG, "svg");
	svg.setAttribute("viewBox", "0 0 14 14");
	svg.setAttribute("fill", "none");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("stroke-width", "1.5");
	svg.setAttribute("aria-hidden", "true");
	svg.setAttribute("class", "size-3.5");
	const path = document.createElementNS(SVG, "path");
	path.setAttribute("d", CHECK_MARK_PATH);
	svg.append(path);
	box.append(svg);
	/** The item stands one before the box's place, its own start. */
	const item = () => {
		const at = getPos();
		return at === undefined ? null : at - 1;
	};
	box.addEventListener("mousedown", (event) => {
		// The press is the box's: the caret does not move into the item. A right click opens the browser's menu and changes nothing.
		event.preventDefault();
		const pos = item();
		if (event.button !== 0 || !view.editable || pos === null) return;
		toggleItem(view, pos);
	});
	box.addEventListener("keydown", (event) => {
		if (event.key !== " " || !view.editable) return;
		event.preventDefault();
		const pos = item();
		if (pos === null) return;
		toggleItem(view, pos);
		// The box is drawn again in its new state: the focus goes to the new one.
		(view.nodeDOM(pos) as HTMLElement | null)?.querySelector<HTMLElement>("[data-check]")?.focus();
	});
	return box;
}

/**
 * A checklist item's box (editor-tools.md, `EditorBody`): put at the start of each item of a checklist, pressed or Spaced to tick or untick it where the
 * text is written. Read only, it is the mark of the item's state, no stop of the keyboard, and nothing happens on a press.
 */
export function checklistBoxes(label: () => string) {
	return Extension.create({
		name: "montiChecklistBoxes",
		addProseMirrorPlugins() {
			const editor = this.editor;
			const checklist = nodeName("checklist");
			return [
				new Plugin({
					props: {
						decorations: (state) => {
							const decorations: Decoration[] = [];
							const name = label();
							const editable = editor.isEditable;
							state.doc.descendants((node, pos, parent) => {
								if (parent?.type.name !== checklist) return;
								const checked = Boolean(node.attrs.data?.checked);
								decorations.push(
									Decoration.widget(pos + 1, (view, getPos) => checkBox(view, getPos, checked, name, editable), {
										side: -1,
										// Drawn again when its state, the admin's language or whether the text is written changes.
										key: `check-${checked}-${name}-${editable}`,
										ignoreSelection: true,
										// Its presses and keys are its own, not the text's.
										stopEvent: () => true,
									}),
								);
								return false;
							});
							return DecorationSet.create(state.doc, decorations);
						},
					},
				}),
			];
		},
	});
}

type Marked = { menuOpen: number | null; held: number | null };
const statesKey = new PluginKey<Marked>("montiBodyStates");

/** Marks the block whose menu is open (`data-menu-open`), or none. */
export const markMenuOpen = (state: EditorState, pos: number | null) => state.tr.setMeta(statesKey, { menuOpen: pos });

/** Marks the block being dragged (`data-held`): its place stays as a gap while its copy follows the pointer. */
export const markHeld = (state: EditorState, pos: number | null) => state.tr.setMeta(statesKey, { held: pos });

export type BodyStateLabels = { placeholder: string; off: string };

/**
 * The states `EditorBody` draws (editor-tools.md): the empty top-level line under the cursor (or the one line of an empty body) says how to add a
 * block; the block whose menu is open has the block ground; a block the collection's editor no longer offers is faint with "off" after it.
 */
export function bodyStates({
	labels,
	offered,
}: {
	labels: () => BodyStateLabels;
	/** Whether the collection's editor offers a block (its allowance, doc 01). */
	offered: () => (node: EditorNode) => boolean;
}) {
	return Extension.create({
		name: "montiBodyStates",
		addProseMirrorPlugins() {
			const editor = this.editor;
			return [
				new Plugin({
					key: statesKey,
					state: {
						init: (): Marked => ({ menuOpen: null, held: null }),
						apply: (transaction, value) => {
							const meta = transaction.getMeta(statesKey) as Partial<Marked> | undefined;
							if (meta) return { ...value, ...meta };
							if (!transaction.docChanged) return value;
							const map = (pos: number | null) => (pos === null ? null : transaction.mapping.map(pos));
							return { menuOpen: map(value.menuOpen), held: map(value.held) };
						},
					},
					props: {
						decorations: (state) => {
							const decorations: Decoration[] = [];
							const { placeholder, off } = labels();
							const isOffered = offered();
							const { doc, selection } = state;
							const only = doc.childCount === 1 ? doc.firstChild : null;
							doc.forEach((node, pos) => {
								// An undecided block of a translation shows the source's words instead (translation.ts).
								const undecided = (node.attrs.link as { state?: string } | null)?.state === "pending";
								const empty = node.type.name === "paragraph" && node.content.size === 0 && !undecided;
								const underCursor = selection.empty && selection.$from.depth === 1 && selection.$from.before(1) === pos;
								if (empty && editor.isEditable && (underCursor || node === only))
									decorations.push(
										Decoration.node(pos, pos + node.nodeSize, {
											"data-empty": "",
											"data-placeholder": placeholder,
										}),
									);
							});
							doc.descendants((node, pos) => {
								if (!node.isBlock || node.type.name === UNKNOWN || isOffered(node)) return;
								decorations.push(Decoration.node(pos, pos + node.nodeSize, { "data-off": "", "data-off-label": off }));
								return false;
							});
							const marked = statesKey.getState(state);
							for (const [pos, attribute] of [
								[marked?.menuOpen, "data-menu-open"],
								[marked?.held, "data-held"],
							] as const) {
								const node = pos === null || pos === undefined ? null : doc.nodeAt(pos);
								if (node && pos !== null && pos !== undefined)
									decorations.push(Decoration.node(pos, pos + node.nodeSize, { [attribute]: "" }));
							}
							return DecorationSet.create(doc, decorations);
						},
					},
				}),
			];
		},
	});
}
