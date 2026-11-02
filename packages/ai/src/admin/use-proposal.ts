"use client";

import { errorText, useSite, useTranslator } from "@monti-cms/admin";
import { toast } from "@monti-cms/admin/kit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ProposalView } from "../agent/proposal-view";
import { aiKeys, discardProposal, getProposal, includeProposalItems, runProposal } from "./api";
import { proposalMessages } from "./proposal.messages";

/**
 * One proposal as the card and the review page share it: read from the server (and kept in the query cache, so both show the same state), with what can be
 * done to it. `initial` is what the conversation holds; the server's answer replaces it. `progress` is set while applying or undoing.
 */
export function useProposal(id: string, initial?: ProposalView) {
	const site = useSite();
	const t = useTranslator(proposalMessages);
	const client = useQueryClient();
	const key = aiKeys.proposal(id);
	const query = useQuery({
		queryKey: key,
		queryFn: ({ signal }) => getProposal(site, id, { signal, fallback: t("review.failed") }),
		...(initial ? { initialData: initial, initialDataUpdatedAt: 0 } : {}),
	});
	const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
	const set = (view: ProposalView) => client.setQueryData(key, view);

	const run = async (action: "apply" | "revert", total: number) => {
		setProgress({ done: 0, total });
		try {
			set(await runProposal(id, action, (done, of) => setProgress({ done, total: of }), t(`error.${action}`)));
		} catch (error) {
			toast.error(errorText(site, error, t(`error.${action}`)));
		} finally {
			setProgress(null);
		}
	};
	const discard = async () => {
		try {
			set(await discardProposal(site, id, t("error.discard")));
		} catch (error) {
			toast.error(errorText(site, error, t("error.discard")));
		}
	};
	const include = async (changes: Record<string, boolean>) => {
		const current = query.data;
		// Shown at once; the server's answer replaces it.
		if (current) {
			set({
				...current,
				items: current.items.map((item) =>
					Object.hasOwn(changes, item.id) ? { ...item, included: Boolean(changes[item.id]) } : item,
				),
			});
		}
		try {
			set(await includeProposalItems(site, id, changes, t("review.failed")));
		} catch (error) {
			if (current) set(current);
			toast.error(errorText(site, error, t("review.failed")));
		}
	};

	const view = query.data;
	return {
		view,
		error: query.error,
		progress,
		apply: () => run("apply", view?.items.filter((item) => item.included && item.state === "pending").length ?? 0),
		revert: () => run("revert", view?.items.filter((item) => item.state === "applied").length ?? 0),
		discard,
		include,
	};
}
