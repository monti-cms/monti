import { Extension, InputRule } from "@tiptap/core";
import { exitCode, lift, newlineInCode } from "@tiptap/pm/commands";
import { TextSelection } from "@tiptap/pm/state";
import type { Catalog } from "./catalog";
import {
	clearFormats,
	deleteBlock,
	duplicateBlock,
	handleTarget,
	type Kind,
	kindKey,
	moveBlock,
	offeredKinds,
	turnInto,
} from "./commands";
import { nodeName } from "./schema";

/**
 * Typing the markdown at the start of a line turns it into its block (`## `, `- `, `1. `, `[] `, `> `, ```` ``` ````, `---`), and the block keys of
 * the block menu (⌥↑ ⌥↓ ⇧⌘D ⇧⌘⌫). A shortcut for a kind the collection's editor does not offer does nothing.
 */
export function bodyKeys(offered: () => Catalog) {
	const allowed = (kind: Kind) => offeredKinds(offered()).some((each) => kindKey(each) === kindKey(kind));
	const rule = (find: RegExp, kind: (match: RegExpMatchArray) => Kind) =>
		new InputRule({
			find,
			handler: ({ state, range, match }) => {
				const { $from } = state.selection;
				const wanted = kind(match);
				if ($from.parent.type.name !== "paragraph" || !allowed(wanted)) return null;
				const tr = state.tr.delete(range.from, range.to);
				turnInto(tr, $from.before(), wanted);
			},
		});
	return Extension.create({
		name: "montiBodyKeys",
		addInputRules() {
			return [
				rule(/^(#{2,4})\s$/, (match) => ({ type: "heading", level: match[1]?.length ?? 2 })),
				rule(/^[-*]\s$/, () => ({ type: "bulletList" })),
				rule(/^1\.\s$/, () => ({ type: "orderedList" })),
				rule(/^\[[ x]?\]\s$/, () => ({ type: "checklist" })),
				rule(/^>\s$/, () => ({ type: "quote" })),
				rule(/^```$/, () => ({ type: "codeBlock" })),
				new InputRule({
					find: /^---$/,
					handler: ({ state, range }) => {
						const { $from } = state.selection;
						const divider = state.schema.nodes[nodeName("divider")];
						if (
							$from.parent.type.name !== "paragraph" ||
							!divider ||
							!offered().blocks.some((b) => b.type === "divider")
						)
							return null;
						const tr = state.tr.delete(range.from, range.to);
						const at = $from.before();
						tr.insert(at, divider.create());
						tr.setSelection(TextSelection.near(tr.doc.resolve(at + 2)));
					},
				}),
			];
		},
		addKeyboardShortcuts() {
			const onBlock =
				(run: (tr: import("@tiptap/pm/state").Transaction, pos: number) => unknown) =>
				({ editor }: { editor: import("@tiptap/core").Editor }) => {
					const pos = handleTarget(editor.state.selection.$from);
					if (pos === null) return false;
					const tr = editor.state.tr;
					run(tr, pos);
					if (!tr.docChanged) return false;
					editor.view.dispatch(tr.scrollIntoView());
					return true;
				};
			const atStart = (editor: import("@tiptap/core").Editor) =>
				editor.state.selection.empty && editor.state.selection.$from.parentOffset === 0;
			return {
				"Alt-ArrowUp": onBlock((tr, pos) => moveBlock(tr, pos, -1)),
				"Alt-ArrowDown": onBlock((tr, pos) => moveBlock(tr, pos, 1)),
				"Mod-Shift-d": onBlock((tr, pos) => duplicateBlock(tr, pos)),
				"Mod-Shift-Backspace": onBlock((tr, pos) => deleteBlock(tr, pos)),
				Enter: ({ editor }) => {
					const { $from } = editor.state.selection;
					const node = $from.parent;
					if (node.type.name === nodeName("codeBlock")) return newlineInCode(editor.state, editor.view.dispatch);
					// An empty list item ends the list: it becomes a line of its own.
					if (node.type.name === nodeName("listItem") && node.content.size === 0) {
						const tr = editor.state.tr;
						turnInto(tr, $from.before(), { type: "paragraph" });
						editor.view.dispatch(tr);
						return true;
					}
					return false;
				},
				"Mod-Enter": ({ editor }) => exitCode(editor.state, editor.view.dispatch),
				// Clear formatting: the selected words, or with nothing selected the run of formats the caret is in.
				"Mod-\\": ({ editor }) => clearFormats(editor.state, editor.view.dispatch),
				Backspace: ({ editor }) => {
					if (!atStart(editor)) return false;
					const { $from } = editor.state.selection;
					const node = $from.parent;
					// At the start of a heading, a list item or code, Backspace first makes it a paragraph; in a quote, it takes the line out.
					if (node.type.name !== "paragraph") {
						const tr = editor.state.tr;
						turnInto(tr, $from.before(), { type: "paragraph" });
						if (!tr.docChanged) return false;
						editor.view.dispatch(tr);
						return true;
					}
					if ($from.depth > 1 && $from.index($from.depth - 1) === 0) return lift(editor.state, editor.view.dispatch);
					return false;
				},
			};
		},
	});
}
