import { type Editor, Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** Class of the block whose handle menu is open; the editor's styles give it the block ground. */
export const MENU_OPEN_CLASS = "monti-menu-open";

const menuKey = new PluginKey<number | null>("cmsBlockMenu");

/** Marks the block at `pos` as the one the open block menu is about, or clears the mark (`null`). */
export const markBlockMenu = (editor: Editor, pos: number | null) => {
	if (editor.isDestroyed) return;
	editor.view.dispatch(editor.state.tr.setMeta(menuKey, pos).setMeta("addToHistory", false));
};

/** Gives the block whose handle menu is open the block ground, so the menu is seen to be about that block. The mark follows the block while the document changes. */
export const CmsBlockMenuMark = Extension.create({
	name: "cmsBlockMenuMark",
	addProseMirrorPlugins() {
		return [
			new Plugin<number | null>({
				key: menuKey,
				state: {
					init: () => null,
					apply: (tr, pos) => {
						const next = tr.getMeta(menuKey);
						if (next !== undefined) return next;
						return pos === null ? null : tr.mapping.map(pos);
					},
				},
				props: {
					decorations: (state) => {
						const pos = menuKey.getState(state);
						const node = pos == null ? null : state.doc.nodeAt(pos);
						if (pos == null || !node) return null;
						return DecorationSet.create(state.doc, [
							Decoration.node(pos, pos + node.nodeSize, { class: MENU_OPEN_CLASS }),
						]);
					},
				},
			}),
		];
	},
});
