"use client";

import { useSite, useTranslator } from "@monti-cms/admin";
import { Ins, ProposalActions, ProposalCard, ProposalItem, ProposalResult, ProposalRow } from "@monti-cms/admin/kit";
import { useAdminRouter } from "@monti-cms/admin/router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { ProposalView } from "../agent/proposal-view";
import { aiKeys } from "./api";
import { proposalMessages } from "./proposal.messages";
import { groupsOf, groupWords, isMediaTextOnly, reasonWords, timeOf } from "./proposal-groups";
import { useProposal } from "./use-proposal";

/** The review page of a proposal (`/admin/ai/review/<id>`). */
export const reviewHref = (id: string) => `/ai/review/${encodeURIComponent(id)}`;

/** Files a card of new texts shows; the rest are on the review page. */
const FIRST_FILES = 3;

/**
 * A proposal in the conversation (flow 2 · 11, 16, 19): the groups of changes (or, for alt texts, each file's new text), where it stands, and what can be done
 * — open the review page, discard, apply (with the progress), and once applied undo all, with the items that could not be applied and why. The card keeps
 * the proposal as the server last answered it.
 */
export function AgentProposal({ initial }: { initial: ProposalView }) {
	const site = useSite();
	const router = useAdminRouter();
	const t = useTranslator(proposalMessages);
	const proposal = useProposal(initial.id, initial);
	const client = useQueryClient();
	// A proposal that arrives or grows may change the open entry: its editor reads its waiting changes again.
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when the proposal arrives and each time it grows
	useEffect(() => {
		void client.invalidateQueries({ queryKey: [...aiKeys.all, "entry-proposals"] });
	}, [client, initial.id, initial.items.length]);
	const view = proposal.view ?? initial;
	const { progress } = proposal;
	const groups = groupsOf(view);
	const textOnly = isMediaTextOnly(view);
	const waiting = view.items.filter((item) => item.included && item.state === "pending").length;
	const applied = view.items.filter(
		(item) => item.state === "applied" || item.state === "reverted" || item.state === "kept",
	);
	const failed = view.items.filter((item) => item.included && (item.state === "failed" || item.state === "stale"));
	const busy = progress !== null;
	// Files are counted as files ("Apply 3"); anything else as changes ("Apply 19").
	const allMedia = view.items.every((item) => item.target.kind === "media");
	// A card of new texts lists its files; when there are more than fit, it shows the first ones and sends the rest to the review page.
	const hidden = textOnly ? Math.max(0, view.items.length - FIRST_FILES) : 0;
	const reviewable = !textOnly || hidden > 0;

	const first = groups[0];
	const summary =
		textOnly && first
			? t("summary.single", { name: groupWords(site, first).name, count: groupWords(site, first).count })
			: t("summary", { groups: groups.length, count: view.items.length });
	const status = busy
		? { text: t("status.applying", progress), tone: "subtle" as const }
		: view.status === "pending"
			? { text: t("status.pending"), tone: "warning" as const }
			: view.status === "applied" || view.status === "partial"
				? { text: t("status.applied"), tone: "success" as const }
				: view.status === "reverted"
					? { text: t("status.reverted", { time: timeOf(view.settledAt) }), tone: "subtle" as const }
					: { text: t("status.discarded"), tone: "subtle" as const };

	return (
		<ProposalCard
			data-testid="agent-proposal"
			title={t("title")}
			summary={summary}
			status={status.text}
			statusTone={status.tone}
			muted={view.status === "discarded"}
			footer={
				view.status === "pending" ? (
					<ProposalActions
						{...(reviewable
							? { reviewLabel: t("review"), onReview: () => router.navigate(site.adminHref(reviewHref(view.id))) }
							: {})}
						discardLabel={t("discard")}
						onDiscard={() => void proposal.discard()}
						applyLabel={t(allMedia ? "apply.files" : "apply", { count: waiting })}
						onApply={() => void proposal.apply()}
						busy={busy}
					/>
				) : view.status === "applied" || view.status === "partial" ? (
					<ProposalResult
						appliedLabel={t("applied", { count: applied.length })}
						{...(failed.length > 0 ? { failedLabel: t("failed", { count: failed.length }) } : {})}
						time={timeOf(view.settledAt)}
						undoLabel={t("undo")}
						onUndo={() => void proposal.revert()}
						busy={busy}
					/>
				) : undefined
			}
			after={
				view.status === "applied" || view.status === "partial"
					? failed.map((item) => (
							<ProposalRow
								key={item.id}
								name={t("failed.row")}
								detail={item.subject?.title ?? item.target.id}
								count={reasonWords(site, item.reason)}
								tone="danger"
							/>
						))
					: undefined
			}
		>
			{textOnly ? (
				<>
					{view.items.slice(0, FIRST_FILES).map((item) => (
						<ProposalItem key={item.id} title={item.subject?.title ?? item.target.id}>
							<Ins>{String(item.preview.after ?? "")}</Ins>
						</ProposalItem>
					))}
					{hidden > 0 && <ProposalRow detail={t("moreFiles", { count: hidden })} />}
				</>
			) : (
				groups.map((group) => {
					const words = groupWords(site, group);
					return <ProposalRow key={group.key} name={words.name} detail={words.detail} count={words.count} />;
				})
			)}
		</ProposalCard>
	);
}
