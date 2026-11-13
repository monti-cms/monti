import { newBlockId } from "@monti-cms/core";
import { Extension } from "@tiptap/core";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
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

type Marked = { menuOpen: number | null; held: number[] };
const statesKey = new PluginKey<Marked>("montiBodyStates");

/** Marks the block whose menu is open (`data-menu-open`), or none. */
export const markMenuOpen = (state: EditorState, pos: number | null) => state.tr.setMeta(statesKey, { menuOpen: pos });

/** Marks the blocks being dragged (`data-held`): their places stay as gaps while a card of them follows the pointer. */
export const markHeld = (state: EditorState, held: readonly number[]) =>
	state.tr.setMeta(statesKey, { held: [...held] });

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
						init: (): Marked => ({ menuOpen: null, held: [] }),
						apply: (transaction, value) => {
							const meta = transaction.getMeta(statesKey) as Partial<Marked> | undefined;
							if (meta) return { ...value, ...meta };
							if (!transaction.docChanged) return value;
							const map = (pos: number | null) => (pos === null ? null : transaction.mapping.map(pos));
							return { menuOpen: map(value.menuOpen), held: value.held.map((pos) => transaction.mapping.map(pos)) };
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
								...(marked?.held ?? []).map((pos) => [pos, "data-held"] as const),
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
