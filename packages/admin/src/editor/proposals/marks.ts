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
}

export interface ProposalMarksState {
	readonly proposals: readonly BlockProposal[];
	/** The proposal being looked at: its block gets the blue line in the margin. */
	readonly current: string | null;
	readonly decorations: DecorationSet;
}

export type ProposalMarksMeta = { readonly proposals?: readonly BlockProposal[]; readonly current?: string | null };

export const proposalMarksKey = new PluginKey<ProposalMarksState>("cmsProposalMarks");

/** The attribute on every decoration of a proposal, so a click on one finds it. */
export const PROPOSAL_ATTRIBUTE = "data-proposal-item";

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

function decorate(doc: ProseMirrorNode, proposals: readonly BlockProposal[], current: string | null): DecorationSet {
	const blocks = blocksById(doc);
	const decorations: Decoration[] = [];
	for (const proposal of drawable(doc, proposals)) {
		const found = blocks.get(proposal.blockId);
		if (!found) continue;
		const { node, pos } = found;
		const attrs = { [PROPOSAL_ATTRIBUTE]: proposal.id };
		const lineClass = proposal.id === current ? PROPOSAL_MARK_CLASSES.current : "";
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
	): ProposalMarksState => ({
		proposals,
		current,
		decorations: decorate(state.doc, proposals, current),
	});
	return new Plugin<ProposalMarksState>({
		key: proposalMarksKey,
		state: {
			init: (_, state) => build(state, [], null),
			apply: (tr, value, _old, state) => {
				const meta = tr.getMeta(proposalMarksKey) as ProposalMarksMeta | undefined;
				if (!meta && !tr.docChanged) return value;
				return build(
					state,
					meta?.proposals ?? value.proposals,
					meta && "current" in meta ? (meta.current ?? null) : value.current,
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
