"use client";

import { errorText, type MediaProposalItem, type MediaProposals, useSite, useTranslator } from "@monti-cms/admin";
import { mediaKeys, toast } from "@monti-cms/admin/kit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { MediaProposalView } from "../agent/entry-proposals";
import { aiKeys, askProposalItem, listMediaProposals, settleProposal } from "./api";
import { proposalMessages } from "./proposal.messages";

/**
 * The agent's alt text proposals on the media library's tiles (flow 6 · 25–26). A media file has no save to wait for, so accepting applies at once and
 * discarding leaves the change out; the library and the proposals are read again behind it.
 */
export function useAgentMediaProposals(): MediaProposals | null {
	const site = useSite();
	const t = useTranslator(proposalMessages);
	const client = useQueryClient();
	const query = useQuery({
		queryKey: aiKeys.mediaProposals(),
		queryFn: ({ signal }) => listMediaProposals(site, { signal }),
	});
	// Accepted or discarded and not read back yet: off the tiles at once.
	const [settled, setSettled] = useState<ReadonlySet<string>>(new Set());
	const views = query.data?.items;
	const byId = useMemo(() => new Map((views ?? []).map((view) => [view.id, view])), [views]);

	return useMemo(() => {
		const items = (views ?? [])
			.filter((view) => !settled.has(view.id))
			.map(
				(view: MediaProposalView): MediaProposalItem => ({
					id: view.id,
					request: view.request,
					mediaId: view.mediaId,
					before: view.before,
					value: view.value,
					thread: view.thread,
				}),
			);
		const settle = async (picked: readonly MediaProposalItem[], how: "applied" | "discarded") => {
			setSettled((current) => new Set([...current, ...picked.map((item) => item.id)]));
			const byProposal = new Map<string, string[]>();
			for (const item of picked) {
				const proposalId = byId.get(item.id)?.proposalId;
				if (proposalId) byProposal.set(proposalId, [...(byProposal.get(proposalId) ?? []), item.id]);
			}
			for (const [proposalId, ids] of byProposal) {
				try {
					await settleProposal(site, proposalId, { [how]: ids }, t("error.settle"));
				} catch (error) {
					toast.error(errorText(site, error, t("error.settle")));
				}
				void client.invalidateQueries({ queryKey: aiKeys.proposal(proposalId) });
			}
			void client.invalidateQueries({ queryKey: aiKeys.mediaProposals() });
			if (how === "applied") void client.invalidateQueries({ queryKey: mediaKeys.all });
		};
		return {
			items,
			onAccept: (picked) => void settle(picked, "applied"),
			onDiscard: (picked) => void settle(picked, "discarded"),
			onAsk: async (item, text, signal) => {
				const view = byId.get(item.id);
				if (!view) return null;
				try {
					const { item: next } = await askProposalItem(site, view.proposalId, item.id, text, t("error.ask"), signal);
					// The new proposal is read back with the list; until then the card waits on it.
					void client.invalidateQueries({ queryKey: aiKeys.mediaProposals() });
					return next?.id ?? null;
				} catch (error) {
					if (!signal.aborted) toast.error(errorText(site, error, t("error.ask")));
					throw error;
				}
			},
		};
	}, [views, settled, byId, site, t, client]);
}
