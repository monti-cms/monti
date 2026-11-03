import type { CmsNode } from "@monti-cms/core/document";
import { PROPOSAL_MARK_CLASSES } from "@monti-cms/ui";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { BLOCK_ID_ATTRIBUTE } from "../block-ids";
import { diffWords } from "./word-diff";

/** A proposal of a body change as the editor draws it: the top-level block it replaces, the block as it was planned against, and what takes its place. */
export interface BlockProposal {
	readonly id: string;
	readonly blockId: string;
	/** The block as the proposal was planned against. When the open block reads otherwise, a person changed it meanwhile and the proposal is not drawn. */
	readonly block: CmsNode;
	/** The blocks that take its place; none removes it. */
	readonly nodes: readonly CmsNode[];
	/** The requests left in its card, and whether the assistant is working on one: its block then has the request marker in the margin. */
	readonly requests?: number;
	readonly working?: boolean;
}

/**
 * Words the admin selected to ask the assistant about (⌘J, flow 2 · 09b–c): drawn on the highlight background until the answer comes as a proposal. Its
 * range follows the edits around it. While the assistant works, its block has the request marker ("…").
 */
export interface SelectionRequest {
	readonly key: string;
	readonly from: number;
	readonly to: number;
	readonly working: boolean;
}

export interface ProposalMarksState {
	readonly proposals: readonly BlockProposal[];
	/** The proposal being looked at: its block gets the blue line in the margin. */
	readonly current: string | null;
	readonly spots: readonly SelectionRequest[];
	readonly decorations: DecorationSet;
}

export type ProposalMarksMeta = {
	readonly proposals?: readonly BlockProposal[];
	readonly current?: string | null;
	/** Adds a selection request, marks one working (or not), or takes one away. */
	readonly addSpot?: SelectionRequest;
	readonly spotWorking?: { readonly key: string; readonly working: boolean };
	readonly removeSpot?: string;
};

/** The id a selection request goes by where proposals and requests share one name: the card that is open, the marker's place. */
export const spotId = (key: string) => `spot:${key}`;
export const spotKeyOf = (id: string | null): string | null => (id?.startsWith("spot:") ? id.slice(5) : null);

/** The highlight of selected words (the `Highlight` part's look), on the text itself. */
const HIGHLIGHT_CLASS = "rounded-monti-sm bg-monti-highlight cursor-pointer";

export const proposalMarksKey = new PluginKey<ProposalMarksState>("cmsProposalMarks");

/** The attribute on every decoration of a proposal, so a click on one finds it. */
export const PROPOSAL_ATTRIBUTE = "data-proposal-item";

/** The attribute of the empty place at the start of a block where its request marker is drawn (the editor's React tree renders the marker into it). */
export const MARKER_ATTRIBUTE = "data-proposal-marker";

const markerWidget = (id: string) => () => {
	const element = document.createElement("span");
	element.setAttribute(MARKER_ATTRIBUTE, id);
	element.contentEditable = "false";
	return element;
};

const isInline = (node: CmsNode) => node.type === "text" || node.type === "hardBreak";

/** The text of stored blocks as the marks compare it: the text of each run of inline content, the runs joined by a line break. */
export function plainOfStored(nodes: readonly CmsNode[]): string {
	const runs: string[] = [];
	const walk = (node: CmsNode) => {
		const children = node.content ?? [];
		if (children.length > 0 && children.every(isInline)) {
			runs.push(children.map((child) => (child.type === "text" ? (child.text ?? "") : "\n")).join(""));
			return;
		}
		for (const child of children) walk(child);
	};
	for (const node of nodes) walk(node);
	return runs.join("\n");
}

/** Where each character of a block's plain text sits in the document: the text of each textblock, the textblocks joined by a line break. */
function plainOfBlock(block: ProseMirrorNode, start: number): { text: string; posOf: (offset: number) => number } {
	const segments: { offset: number; pos: number; length: number }[] = [];
	let text = "";
	block.descendants((node, pos) => {
		if (!node.isTextblock) return true;
		if (text) text += "\n";
		node.forEach((child, childOffset) => {
			const length = child.isText ? (child.text ?? "").length : 1;
			segments.push({ offset: text.length, pos: start + 1 + pos + 1 + childOffset, length });
			text += child.isText ? (child.text ?? "") : "\n";
		});
		return false;
	});
	if (block.isTextblock) {
		block.forEach((child, childOffset) => {
			const length = child.isText ? (child.text ?? "").length : 1;
			segments.push({ offset: text.length, pos: start + 1 + childOffset, length });
			text += child.isText ? (child.text ?? "") : "\n";
		});
	}
	const posOf = (offset: number) => {
		for (const segment of segments) {
			if (offset <= segment.offset + segment.length) return segment.pos + Math.max(0, offset - segment.offset);
		}
		const last = segments.at(-1);
		return last ? last.pos + last.length : start + 1;
	};
	return { text, posOf };
}

/** The top-level blocks of the document by block id, with their positions. */
export function blocksById(doc: ProseMirrorNode): Map<string, { node: ProseMirrorNode; pos: number }> {
	const found = new Map<string, { node: ProseMirrorNode; pos: number }>();
	doc.forEach((node, pos) => {
		const id = node.attrs[BLOCK_ID_ATTRIBUTE];
		if (typeof id === "string") found.set(id, { node, pos });
	});
	return found;
}

/** The top-level block that holds a position. */
export function topBlockAt(doc: ProseMirrorNode, pos: number): { node: ProseMirrorNode; pos: number } | null {
	const resolved = doc.resolve(Math.min(Math.max(pos, 0), doc.content.size));
	if (resolved.depth < 1) return null;
	const node = resolved.node(1);
	return { node, pos: resolved.before(1) };
}

/** The proposals that can be drawn: their block is there and reads as it did when they were planned, in the order of the document. */
export function drawable(doc: ProseMirrorNode, proposals: readonly BlockProposal[]): BlockProposal[] {
	const blocks = blocksById(doc);
	const order = [...blocks.keys()];
	return proposals
		.filter((proposal) => {
			const found = blocks.get(proposal.blockId);
			return found !== undefined && plainOfBlock(found.node, found.pos).text === plainOfStored([proposal.block]);
		})
		.sort((a, b) => order.indexOf(a.blockId) - order.indexOf(b.blockId));
}

/**
 * An inserted run, drawn where it goes: the blue pencil's `ins`, keeping its line breaks. Right after struck-through words it is set off by a space, so the
 * old and the new words read apart ("~~made up my mind to~~ decided").
 */
const insWidget = (text: string, id: string, afterDel: boolean) => () => {
	const element = document.createElement("ins");
	element.className = `${PROPOSAL_MARK_CLASSES.ins} whitespace-pre-wrap`;
	element.setAttribute(PROPOSAL_ATTRIBUTE, id);
	element.textContent = text;
	if (!afterDel) return element;
	const holder = document.createElement("span");
	holder.append(" ", element);
	return holder;
};

function decorate(
	doc: ProseMirrorNode,
	proposals: readonly BlockProposal[],
	current: string | null,
	spots: readonly SelectionRequest[],
): DecorationSet {
	const blocks = blocksById(doc);
	const decorations: Decoration[] = [];
	for (const spot of spots) {
		if (spot.to <= spot.from) continue;
		const id = spotId(spot.key);
		decorations.push(Decoration.inline(spot.from, spot.to, { [PROPOSAL_ATTRIBUTE]: id, class: HIGHLIGHT_CLASS }));
		if (!spot.working) continue;
		const block = topBlockAt(doc, spot.from);
		if (!block) continue;
		decorations.push(Decoration.node(block.pos, block.pos + block.node.nodeSize, { class: "relative" }));
		decorations.push(
			Decoration.widget(block.pos + 1, markerWidget(id), { side: -1, ignoreSelection: true, key: `marker:${id}` }),
		);
	}
	for (const proposal of drawable(doc, proposals)) {
		const found = blocks.get(proposal.blockId);
		if (!found) continue;
		const { node, pos } = found;
		const attrs = { [PROPOSAL_ATTRIBUTE]: proposal.id };
		const lineClass = proposal.id === current ? PROPOSAL_MARK_CLASSES.current : "";
		if ((proposal.requests ?? 0) > 0 || proposal.working) {
			// The marker hangs in the block's margin: the block is its positioning box.
			decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: "relative" }));
			decorations.push(
				Decoration.widget(pos + 1, markerWidget(proposal.id), {
					side: -1,
					ignoreSelection: true,
					key: `marker:${proposal.id}`,
				}),
			);
		}
		if (proposal.nodes.length === 0) {
			// The block goes: all of it in the strike-through.
			decorations.push(
				Decoration.node(pos, pos + node.nodeSize, {
					...attrs,
					class: `${PROPOSAL_MARK_CLASSES.del} cursor-pointer ${lineClass}`,
				}),
			);
			continue;
		}
		if (lineClass) decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: lineClass }));
		const { text, posOf } = plainOfBlock(node, pos);
		let offset = 0;
		const parts = diffWords(text, plainOfStored(proposal.nodes));
		for (const [index, part] of parts.entries()) {
			if (part.type === "add") {
				const afterDel = parts[index - 1]?.type === "del";
				decorations.push(
					Decoration.widget(posOf(offset), insWidget(part.text, proposal.id, afterDel), {
						side: 1,
						key: `${proposal.id}:${index}:${part.text}`,
					}),
				);
				continue;
			}
			const end = offset + part.text.length;
			if (part.type === "del" && end > offset) {
				decorations.push(
					Decoration.inline(posOf(offset), posOf(end), {
						...attrs,
						class: `${PROPOSAL_MARK_CLASSES.del} cursor-pointer`,
					}),
				);
			}
			offset = end;
		}
	}
	return DecorationSet.create(doc, decorations);
}

/**
 * Draws the assistant's proposals for the open entry as the blue pencil (docs/design/agent-editor.md): in each block a proposal replaces, the words that go
 * are struck through and the words that come are put in where they go; a block that goes is struck through whole. The document is not changed until a
 * proposal is accepted. A proposal whose block a person changed is not drawn.
 */
export function proposalMarksPlugin(onPick: (id: string) => void): Plugin<ProposalMarksState> {
	const build = (
		state: EditorState,
		proposals: readonly BlockProposal[],
		current: string | null,
		spots: readonly SelectionRequest[],
	): ProposalMarksState => ({
		proposals,
		current,
		spots,
		decorations: decorate(state.doc, proposals, current, spots),
	});
	return new Plugin<ProposalMarksState>({
		key: proposalMarksKey,
		state: {
			init: (_, state) => build(state, [], null, []),
			apply: (tr, value, _old, state) => {
				const meta = tr.getMeta(proposalMarksKey) as ProposalMarksMeta | undefined;
				if (!meta && !tr.docChanged) return value;
				// The selected words follow the edits around them; words deleted whole are gone.
				let spots = tr.docChanged
					? value.spots
							.map((spot) => ({ ...spot, from: tr.mapping.map(spot.from, 1), to: tr.mapping.map(spot.to, -1) }))
							.filter((spot) => spot.to > spot.from)
					: value.spots;
				if (meta?.addSpot) spots = [...spots, meta.addSpot];
				if (meta?.spotWorking) {
					const { key, working } = meta.spotWorking;
					spots = spots.map((spot) => (spot.key === key ? { ...spot, working } : spot));
				}
				const removed = meta?.removeSpot;
				if (removed) spots = spots.filter((spot) => spot.key !== removed);
				return build(
					state,
					meta?.proposals ?? value.proposals,
					meta && "current" in meta ? (meta.current ?? null) : value.current,
					spots,
				);
			},
		},
		props: {
			decorations: (state) => proposalMarksKey.getState(state)?.decorations,
			handleClick: (_view, _pos, event) => {
				const target = (event.target as HTMLElement | null)?.closest(`[${PROPOSAL_ATTRIBUTE}]`);
				const id = target?.getAttribute(PROPOSAL_ATTRIBUTE);
				if (!id) return false;
				onPick(id);
				return true;
			},
		},
	});
}
