import type { TranslationLink } from "@monti-cms/core";
import { Extension } from "@tiptap/core";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** A top-level block's translation link, when it has one (doc 04). */
export const linkOf = (node: EditorNode): TranslationLink | null => (node.attrs.link as TranslationLink | null) ?? null;

/**
 * A translation's blocks as the editor shows them (doc 04): a block still in the source's words is dimmed (`EditorBody`'s `data-untranslated`), and
 * typing in it takes the dimming away at once, as saving makes it translated. The links are the core's; this only draws them.
 */
/** A source block new since the translation, shown where it would go: after a block (`null`: first), in the dimmed look. */
export type Ghost = { key: string; after: string | null; text: string };

const ghostsKey = new PluginKey<Ghost[]>("montiTranslationGhosts");

/** Shows these new source blocks as dimmed lines, not part of the text (they come in only when the person brings them in). */
export const showGhosts = (state: EditorState, ghosts: Ghost[]) =>
	state.tr.setMeta(ghostsKey, ghosts).setMeta("addToHistory", false);

export const TranslationBlocks = Extension.create({
	name: "montiTranslationBlocks",
	addProseMirrorPlugins() {
		return [
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
					const old = new Map<string, EditorNode>();
					before.doc.forEach((node) => {
						if (node.attrs.blockId) old.set(String(node.attrs.blockId), node);
					});
					const tr = after.tr;
					after.doc.forEach((node, pos) => {
						const link = linkOf(node);
						if (!link || (link.state !== "pending" && link.state !== "followSource")) return;
						const was = old.get(String(node.attrs.blockId));
						if (was && !was.content.eq(node.content))
							tr.setNodeAttribute(pos, "link", { ...link, state: "translated" } satisfies TranslationLink);
					});
					return tr.docChanged ? tr.setMeta("addToHistory", false) : null;
				},
				props: {
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
