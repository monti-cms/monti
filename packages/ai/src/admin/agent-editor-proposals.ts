"use client";

import {
	type EditorExtensionContext,
	type EditorExtensionResult,
	type EditorProposalItem,
	errorText,
	useAskPanel,
	useSite,
	useTranslator,
} from "@monti-cms/admin";
import { toast } from "@monti-cms/admin/kit";
import type { CmsNode } from "@monti-cms/core/document";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/core";
import { useCallback, useMemo, useRef, useState } from "react";
import type { EditorProposalView } from "../agent/entry-proposals";
import { aiKeys, askAtSelection, askProposalItem, listEntryProposals, settleProposal } from "./api";
import { proposalMessages } from "./proposal.messages";

/** The id of the top-level blocks of the editor's document. */
const blockIds = (editor: Editor | null): Set<string> => {
	const ids = new Set<string>();
	editor?.state.doc.forEach((node) => {
		if (typeof node.attrs.blockId === "string") ids.add(node.attrs.blockId);
	});
	return ids;
};

/** Whether an accepted change is still in the document: the blocks put in its place are there, or (a removal) its block is gone. */
const stillIn = (editor: Editor | null, item: EditorProposalItem, placed: readonly string[]) => {
	const ids = blockIds(editor);
	return placed.length > 0 ? placed.every((id) => ids.has(id)) : !ids.has(item.blockId);
};

/**
 * The agent's proposals in the entry editor (docs/design/agent-editor.md): the body changes waiting for the open entry, drawn by the editor as the blue
 * pencil. A discarded change is reported at once; an accepted one when the entry is saved (and only if it is still in the document then: ⌘Z takes it back
 * out). The bubble's name opens the conversation the proposal came from. Words selected in the editor can be asked about (`onAskAt`): the answer is a
 * proposal of its own, added to the list at once.
 */
export function useAgentProposalsExtension(context: EditorExtensionContext): EditorExtensionResult {
	const site = useSite();
	const t = useTranslator(proposalMessages);
	const client = useQueryClient();
	const ask = useAskPanel();
	const entryId = context.getEntry?.().entryId;
	const query = useQuery({
		queryKey: aiKeys.entryProposals(entryId ?? ""),
		queryFn: ({ signal }) => listEntryProposals(site, entryId ?? "", { signal }),
		enabled: Boolean(entryId),
	});
	const editorRef = useRef<Editor | null>(null);
	// Accepted in this editor and not saved yet, by item: its proposal and the blocks put in its place.
	const accepted = useRef(
		new Map<string, { item: EditorProposalItem; proposalId: string; placed: readonly string[] }>(),
	);
	const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
	const views = query.data?.items;
	const byId = useMemo(() => new Map((views ?? []).map((view) => [view.id, view])), [views]);

	const items = useMemo(
		() =>
			(views ?? [])
				.filter((view) => !hidden.has(view.id))
				.map(
					(view: EditorProposalView): EditorProposalItem => ({
						id: view.id,
						request: view.request,
						blockId: view.blockId,
						block: view.block as CmsNode,
						nodes: view.nodes as readonly CmsNode[],
						thread: view.thread,
					}),
				),
		[views, hidden],
	);

	const refresh = useCallback(
		(proposalIds: Iterable<string>) => {
			for (const id of proposalIds) void client.invalidateQueries({ queryKey: aiKeys.proposal(id) });
			if (entryId) void client.invalidateQueries({ queryKey: aiKeys.entryProposals(entryId) });
		},
		[client, entryId],
	);

	const settle = useCallback(
		async (byProposal: Map<string, Parameters<typeof settleProposal>[2]>) => {
			for (const [proposalId, settlement] of byProposal) {
				try {
					await settleProposal(site, proposalId, settlement, t("error.settle"));
				} catch (error) {
					toast.error(errorText(site, error, t("error.settle")));
				}
			}
			refresh(byProposal.keys());
		},
		[site, t, refresh],
	);

	const proposals = useMemo(
		() => ({
			items,
			onAccept: (item: EditorProposalItem, placed: readonly string[]) => {
				const proposalId = byId.get(item.id)?.proposalId;
				if (!proposalId) return;
				accepted.current.set(item.id, { item, proposalId, placed });
				setHidden((current) => new Set([...current, item.id]));
			},
			onDiscard: (discarded: readonly EditorProposalItem[]) => {
				setHidden((current) => new Set([...current, ...discarded.map((item) => item.id)]));
				const byProposal = new Map<string, { discarded: string[] }>();
				for (const item of discarded) {
					const proposalId = byId.get(item.id)?.proposalId;
					if (!proposalId) continue;
					byProposal.set(proposalId, { discarded: [...(byProposal.get(proposalId)?.discarded ?? []), item.id] });
				}
				void settle(byProposal);
			},
			onAsk: async (item: EditorProposalItem, text: string, signal: AbortSignal) => {
				const view = byId.get(item.id);
				if (!view) return null;
				try {
					const { item: next } = await askProposalItem(site, view.proposalId, item.id, text, t("error.ask"), signal);
					// The new change takes the old one's place at once; the list is read again behind it.
					if (entryId) {
						client.setQueryData<{ items: EditorProposalView[] }>(aiKeys.entryProposals(entryId), (data) =>
							data
								? {
										items: data.items.flatMap((candidate) =>
											candidate.id === item.id ? (next ? [next] : []) : [candidate],
										),
									}
								: data,
						);
					}
					refresh([view.proposalId]);
					return next?.id ?? null;
				} catch (error) {
					// A request the admin stopped needs no word.
					if (!signal.aborted) toast.error(errorText(site, error, t("error.ask")));
					throw error;
				}
			},
			...(entryId
				? {
						onAskAt: async (spot: { words: string }, text: string, signal: AbortSignal) => {
							try {
								const { item: next } = await askAtSelection(site, entryId, spot.words, text, t("error.ask"), signal);
								// The new change is drawn at once; the list is read again behind it.
								if (next)
									client.setQueryData<{ items: EditorProposalView[] }>(aiKeys.entryProposals(entryId), (data) =>
										data ? { items: [...data.items, next] } : { items: [next] },
									);
								refresh(next ? [next.proposalId] : []);
								return next?.id ?? null;
							} catch (error) {
								if (!signal.aborted) toast.error(errorText(site, error, t("error.ask")));
								throw error;
							}
						},
					}
				: {}),
			...(ask
				? {
						onOpen: (item: EditorProposalItem) => {
							const runId = byId.get(item.id)?.runId;
							if (runId) ask({ open: runId });
						},
					}
				: {}),
		}),
		[items, byId, settle, ask, site, t, client, entryId, refresh],
	);

	/** Accepted changes taken back out with ⌘Z wait again: they are drawn again and not reported. */
	const dropUndone = useCallback(() => {
		const undone = [...accepted.current].filter(([, { item, placed }]) => !stillIn(editorRef.current, item, placed));
		if (undone.length === 0) return;
		for (const [id] of undone) accepted.current.delete(id);
		setHidden((current) => new Set([...current].filter((id) => !undone.some(([gone]) => gone === id))));
	}, []);

	const onSaved = useCallback(() => {
		dropUndone();
		const byProposal = new Map<string, { accepted: { id: string; placed: string[] }[] }>();
		for (const [id, { proposalId, placed }] of accepted.current) {
			const entry = byProposal.get(proposalId) ?? { accepted: [] };
			entry.accepted.push({ id, placed: [...placed] });
			byProposal.set(proposalId, entry);
		}
		accepted.current.clear();
		if (byProposal.size > 0) void settle(byProposal);
	}, [settle, dropUndone]);

	const onEditor = useCallback(
		(editor: Editor | null) => {
			editorRef.current?.off("update", dropUndone);
			editorRef.current = editor;
			editor?.on("update", dropUndone);
		},
		[dropUndone],
	);

	return { proposals, onSaved, onEditor };
}
