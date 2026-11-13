import { PROPOSAL_MARK_CLASSES } from "@monti-cms/ui";
import { Extension } from "@tiptap/core";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * The words a request to the assistant was left on (doc 10, a request at its place; T64): a blue dotted underline under them while the
 * request waits for its answer. The plugin keeps where each request's words are as the text around them changes.
 */
type Anchor = { id: string; from: number; to: number };
type Change = { add?: Anchor; remove?: string };

export const requestMarksKey = new PluginKey<Anchor[]>("montiRequestMarks");

/** Underlines the words between two places of the text for a request. */
export const anchorRequest = (state: EditorState, anchor: Anchor) =>
	state.tr.setMeta(requestMarksKey, { add: anchor } satisfies Change).setMeta("addToHistory", false);

/** Takes a request's underline away. */
export const releaseRequest = (state: EditorState, id: string) =>
	state.tr.setMeta(requestMarksKey, { remove: id } satisfies Change).setMeta("addToHistory", false);

/** The plain text of a textblock's inline content as `body.read` counts it: a hard break is one character, a footnote's number none. */
const counted = (node: EditorNode) => {
	let text = "";
	node.forEach((child) => {
		if (child.isText) text += child.text;
		else if (child.type.name === "hardBreak") text += "\n";
	});
	return text;
};

/** The picked words as a request names them: their block, where they stand in its text, and the words. */
export type PickedText = { block: string; from: number; to: number; text: string; start: number; end: number };

/**
 * The words picked in the body, when a request can be left on them: a selection of text inside one block that has an id. A selection
 * that runs into the next block is cut at the end of the block it starts in.
 */
export function pickedText(state: EditorState): PickedText | null {
	const { selection } = state;
	if (!(selection instanceof TextSelection) || selection.empty) return null;
	const { $from } = selection;
	const parent = $from.parent;
	if (!parent.isTextblock) return null;
	let block: string | null = null;
	for (let depth = $from.depth; depth > 0 && block === null; depth -= 1) {
		const id = $from.node(depth).attrs.blockId;
		if (typeof id === "string" && id !== "") block = id;
	}
	if (block === null) return null;
	const end = Math.min(selection.to, $from.end());
	const from = counted(parent.cut(0, $from.parentOffset)).length;
	const text = counted(parent.cut($from.parentOffset, end - $from.start()));
	if (text.trim() === "") return null;
	return { block, from, to: from + text.length, text, start: selection.from, end };
}

export const RequestMarks = Extension.create({
	name: "montiRequestMarks",
	addProseMirrorPlugins() {
		return [
			new Plugin<Anchor[]>({
				key: requestMarksKey,
				state: {
					init: () => [],
					apply: (tr, anchors) => {
						const change = tr.getMeta(requestMarksKey) as Change | undefined;
						let next = anchors;
						if (tr.docChanged)
							next = next
								.map((anchor) => ({
									...anchor,
									from: tr.mapping.map(anchor.from, 1),
									to: tr.mapping.map(anchor.to, -1),
								}))
								// Words that were deleted leave nothing to underline: the request stays, hung at its block.
								.map((anchor) => (anchor.to < anchor.from ? { ...anchor, to: anchor.from } : anchor));
						if (change?.remove !== undefined) next = next.filter((anchor) => anchor.id !== change.remove);
						if (change?.add) next = [...next.filter((anchor) => anchor.id !== change.add?.id), change.add];
						return next;
					},
				},
				props: {
					decorations: (state) => {
						const anchors = requestMarksKey.getState(state) ?? [];
						if (anchors.length === 0) return null;
						return DecorationSet.create(
							state.doc,
							anchors
								.filter((anchor) => anchor.to > anchor.from)
								.map((anchor) => Decoration.inline(anchor.from, anchor.to, { class: PROPOSAL_MARK_CLASSES.anchor })),
						);
					},
				},
			}),
		];
	},
});
