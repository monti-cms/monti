import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** Class of the empty line that holds the cursor; the editor's styles draw `data-placeholder` on it. */
export const EMPTY_LINE_CLASS = "monti-empty-line";

/**
 * The hint on the empty line the cursor is on, or on the one empty line of a new post ("Press / to add a block"). Only a top-level paragraph shows it: an empty line inside a list item, a table
 * cell or a component is not a place to start a block. A body that cannot be edited hides it with a style (`contenteditable=false`), since the plugin runs
 * before the editor knows whether it is editable.
 */
export const EmptyLineHint = Extension.create<{ text: string }>({
	name: "cmsEmptyHint",
	addOptions: () => ({ text: "" }),
	addProseMirrorPlugins() {
		const { text } = this.options;
		return [
			new Plugin({
				key: new PluginKey("cmsEmptyHint"),
				props: {
					decorations: (state) => {
						if (!text) return null;
						const { doc, selection } = state;
						const isEmptyLine = (node: typeof doc) => node.type.name === "paragraph" && node.content.size === 0;
						const mark = (pos: number, size: number) =>
							DecorationSet.create(doc, [
								Decoration.node(pos, pos + size, { class: EMPTY_LINE_CLASS, "data-placeholder": text }),
							]);
						// A new post is one empty line: it says how to start, before the cursor is in it.
						const only = doc.childCount === 1 ? doc.child(0) : null;
						if (only && isEmptyLine(only)) return mark(0, only.nodeSize);
						const { $from } = selection;
						if (!selection.empty || $from.depth !== 1 || !isEmptyLine($from.parent)) return null;
						return mark($from.before(), $from.parent.nodeSize);
					},
				},
			}),
		];
	},
});
