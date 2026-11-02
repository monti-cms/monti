"use client";

import { STORED_DOCUMENT_VERSION } from "@monti-cms/core/document";
import { type Site, useSite, useTranslator } from "@monti-cms/core/site";
import { MemoCardPopover, MemoMessage, MemoThread, ProposalBubble, ProposalBubbleDock } from "@monti-cms/ui";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { EditorProposalItem, EditorProposals } from "../../admin-components";
import { BLOCK_ID_ATTRIBUTE } from "../block-ids";
import { storedToTiptap } from "../tiptap-content";
import { blocksById, drawable, proposalMarksKey, proposalMarksPlugin } from "./marks";
import { proposalMarksMessages } from "./messages";

/**
 * Puts one proposal into the open document: its block is replaced by the proposed blocks (or removed). Returns the ids of the blocks put in its place, or
 * `null` when the block is gone.
 */
export function acceptInEditor(editor: Editor, site: Site, item: EditorProposalItem): string[] | null {
	const found = blocksById(editor.state.doc).get(item.blockId);
	if (!found) return null;
	const { node, pos } = found;
	const nodes =
		item.nodes.length === 0
			? []
			: (
					storedToTiptap(site, { type: "doc", version: STORED_DOCUMENT_VERSION, content: item.nodes }).content ?? []
				).map((json) => editor.schema.nodeFromJSON(json));
	const { tr } = editor.state;
	// A document keeps at least one block: removing its only block leaves an empty line.
	if (nodes.length === 0 && editor.state.doc.childCount === 1)
		tr.replaceWith(pos, pos + node.nodeSize, editor.schema.nodes.paragraph?.create() ?? []);
	else if (nodes.length === 0) tr.delete(pos, pos + node.nodeSize);
	else tr.replaceWith(pos, pos + node.nodeSize, nodes);
	editor.view.dispatch(tr);
	// The ids the blocks carry once in the document (the editor gives a new id to one that would repeat another).
	const placed: string[] = [];
	let at = pos;
	for (let index = 0; index < nodes.length; index++) {
		const now = editor.state.doc.nodeAt(at);
		if (!now) break;
		placed.push(String(now.attrs[BLOCK_ID_ATTRIBUTE] ?? ""));
		at += now.nodeSize;
	}
	return placed;
}

/** What a block is called in a card's head: "paragraph 2", "heading 1", by its kind and its place among the blocks of that kind. */
function useBlockName() {
	const t = useTranslator(proposalMarksMessages);
	return (editor: Editor, blockId: string): string => {
		const found = blocksById(editor.state.doc).get(blockId);
		if (!found) return t("block.other", { n: 1 });
		const kind =
			found.node.type.name === "paragraph" ? "paragraph" : found.node.type.name === "heading" ? "heading" : "other";
		let n = 0;
		editor.state.doc.forEach((node, pos) => {
			const same =
				kind === "other"
					? node.type.name !== "paragraph" && node.type.name !== "heading"
					: node.type.name === found.node.type.name;
			if (same && pos <= found.pos) n++;
		});
		return t(`block.${kind}`, { n });
	};
}

/**
 * The assistant's proposals in the open entry (docs/design/agent-editor.md, flow 2 · 08): the blue pencil in the text, the bubble over the status bar
 * ("↑ 1 / 5 ↓", discard all, accept all) and, from a mark, the card with discard and accept for that one. Accepting puts the change in the document as an
 * edit of the admin's, undone with ⌘Z until saved; the sources hear what was accepted and discarded.
 */
export function useProposalMarks(sources: readonly EditorProposals[]): {
	readonly onEditor: (editor: Editor | null) => void;
	readonly overlay: ReactNode;
} {
	const site = useSite();
	const t = useTranslator(proposalMarksMessages);
	const blockName = useBlockName();
	const [editor, setEditor] = useState<Editor | null>(null);
	const [current, setCurrent] = useState<string | null>(null);
	const [card, setCard] = useState<string | null>(null);
	const items = useMemo(() => sources.flatMap((source) => source.items.map((item) => ({ item, source }))), [sources]);
	const itemsRef = useRef(items);
	itemsRef.current = items;

	useEffect(() => {
		if (!editor) return;
		editor.registerPlugin(
			proposalMarksPlugin((id) => {
				setCurrent(id);
				setCard(id);
			}),
		);
		return () => {
			if (!editor.isDestroyed) editor.unregisterPlugin(proposalMarksKey);
		};
	}, [editor]);

	useEffect(() => {
		if (!editor || editor.isDestroyed) return;
		editor.view.dispatch(
			editor.state.tr
				.setMeta(proposalMarksKey, { proposals: items.map(({ item }) => item), current })
				.setMeta("addToHistory", false),
		);
	}, [editor, items, current]);

	// The proposals drawn now, in the order of the text: what the bubble steps through.
	const shown =
		useEditorState({
			editor,
			selector: ({ editor: now }) => {
				const state = now ? proposalMarksKey.getState(now.state) : undefined;
				return now && state ? drawable(now.state.doc, state.proposals).map((proposal) => proposal.id) : [];
			},
			equalityFn: (a, b) =>
				a === b || (a !== null && b !== null && a.length === b.length && a.every((id, index) => id === b[index])),
		}) ?? [];

	const entryOf = (id: string | null) => items.find(({ item }) => item.id === id);
	const position = Math.max(0, shown.indexOf(current ?? ""));
	// The first proposal is the one looked at until another is picked, so its block has the blue line from the start.
	useEffect(() => {
		if (shown.length > 0 && (current === null || !shown.includes(current))) setCurrent(shown[0] ?? null);
	}, [shown, current]);
	const focused = entryOf(shown[position] ?? null);

	/** The element of the block a proposal replaces: where its card hangs from and what stepping scrolls to. */
	const anchorOf = (id: string | null): HTMLElement | null => {
		const found = id && editor ? blocksById(editor.state.doc).get(entryOf(id)?.item.blockId ?? "") : undefined;
		const dom = found && editor ? editor.view.nodeDOM(found.pos) : null;
		return dom instanceof HTMLElement ? dom : null;
	};

	const step = (by: number) => {
		if (shown.length === 0) return;
		const next = shown[(position + by + shown.length) % shown.length] ?? null;
		setCurrent(next);
		setCard(null);
		anchorOf(next)?.scrollIntoView({ block: "center", behavior: "smooth" });
	};

	const accept = (ids: readonly string[]) => {
		if (!editor) return;
		for (const id of ids) {
			const entry = itemsRef.current.find(({ item }) => item.id === id);
			if (!entry) continue;
			const placed = acceptInEditor(editor, site, entry.item);
			if (placed) entry.source.onAccept(entry.item, placed);
		}
		setCard(null);
	};
	const discard = (ids: readonly string[]) => {
		for (const source of sources) {
			const mine = source.items.filter((item) => ids.includes(item.id));
			if (mine.length > 0) source.onDiscard(mine);
		}
		setCard(null);
	};

	const opened = entryOf(card);
	const overlay =
		shown.length === 0 || !focused ? null : (
			<>
				<ProposalBubbleDock>
					<ProposalBubble
						name={focused.item.request}
						{...(focused.source.onOpen ? { onOpen: () => focused.source.onOpen?.(focused.item) } : {})}
						position={position + 1}
						total={shown.length}
						previousLabel={t("previous")}
						nextLabel={t("next")}
						onPrevious={() => step(-1)}
						onNext={() => step(1)}
						discardAllLabel={t("discardAll")}
						onDiscardAll={() => discard(shown)}
						acceptAllLabel={t("acceptAll")}
						onAcceptAll={() => accept(shown)}
					/>
				</ProposalBubbleDock>
				{opened && editor && (
					<MemoCardPopover
						anchor={() => anchorOf(opened.item.id)}
						open
						onOpenChange={(open) => {
							if (!open) setCard(null);
						}}
						where={t("where", { block: blockName(editor, opened.item.blockId) })}
						discardLabel={t("discard")}
						onDiscard={() => discard([opened.item.id])}
						discardShortcut={["mod", "Backspace"]}
						acceptLabel={t("accept")}
						onAccept={() => accept([opened.item.id])}
						acceptShortcut={["mod", "Enter"]}
					>
						<MemoThread>
							<MemoMessage author={t("me")}>{opened.item.request}</MemoMessage>
						</MemoThread>
					</MemoCardPopover>
				)}
			</>
		);

	return { onEditor: setEditor, overlay };
}
