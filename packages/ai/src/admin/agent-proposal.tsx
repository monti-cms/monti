"use client";

import { errorText, useSite, useTranslator } from "@monti-cms/admin";
import {
	Ins,
	ProposalActions,
	ProposalCard,
	ProposalItem,
	ProposalResult,
	ProposalRow,
	toast,
} from "@monti-cms/admin/kit";
import { useAdminRouter } from "@monti-cms/admin/router";
import { useState } from "react";
import type { ProposalView } from "../agent/proposal-view";
import { discardProposal, runProposal } from "./api";
import { proposalMessages } from "./proposal.messages";
import { groupsOf, groupWords, isMediaTextOnly, reasonWords, timeOf } from "./proposal-groups";

/** The review page of a proposal (`/admin/ai/review/<id>`). */
export const reviewHref = (id: string) => `/ai/review/${encodeURIComponent(id)}`;

/**
 * A proposal in the conversation (flow 2 · 11, 16, 19): the groups of changes (or, for alt texts, each file's new text), where it stands, and what can be done
 * — open the review page, discard, apply (with the progress), and once applied undo all, with the items that could not be applied and why. The card keeps
 * the proposal as the server last answered it.
 */
export function AgentProposal({ initial }: { initial: ProposalView }) {
	const site = useSite();
	const router = useAdminRouter();
	const t = useTranslator(proposalMessages);
	const [view, setView] = useState(initial);
	const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
	const groups = groupsOf(view);
	const textOnly = isMediaTextOnly(view);
	const waiting = view.items.filter((item) => item.included && item.state === "pending").length;
	const applied = view.items.filter(
		(item) => item.state === "applied" || item.state === "reverted" || item.state === "kept",
	);
	const failed = view.items.filter((item) => item.included && (item.state === "failed" || item.state === "stale"));
	const busy = progress !== null;
	// Files are counted as files ("3개 적용"); anything else as changes ("19건 적용").
	const allMedia = view.items.every((item) => item.target.kind === "media");

	const run = async (action: "apply" | "revert") => {
		setProgress({ done: 0, total: action === "apply" ? waiting : applied.length });
		try {
			setView(await runProposal(view.id, action, (done, total) => setProgress({ done, total }), t(`error.${action}`)));
		} catch (error) {
			toast.error(errorText(site, error, t(`error.${action}`)));
		} finally {
			setProgress(null);
		}
	};
	const discard = async () => {
		try {
			setView(await discardProposal(site, view.id, t("error.discard")));
		} catch (error) {
			toast.error(errorText(site, error, t("error.discard")));
		}
	};

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
						{...(textOnly
							? {}
							: { reviewLabel: t("review"), onReview: () => router.navigate(site.adminHref(reviewHref(view.id))) })}
						discardLabel={t("discard")}
						onDiscard={() => void discard()}
						applyLabel={t(allMedia ? "apply.files" : "apply", { count: waiting })}
						onApply={() => void run("apply")}
						busy={busy}
					/>
				) : view.status === "applied" || view.status === "partial" ? (
					<ProposalResult
						appliedLabel={t("applied", { count: applied.length })}
						{...(failed.length > 0 ? { failedLabel: t("failed", { count: failed.length }) } : {})}
						time={timeOf(view.settledAt)}
						undoLabel={t("undo")}
						onUndo={() => void run("revert")}
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
			{textOnly
				? view.items.map((item) => (
						<ProposalItem key={item.id} title={item.subject?.title ?? item.target.id}>
							<Ins>{String(item.preview.after ?? "")}</Ins>
						</ProposalItem>
					))
				: groups.map((group) => {
						const words = groupWords(site, group);
						return <ProposalRow key={group.key} name={words.name} detail={words.detail} count={words.count} />;
					})}
		</ProposalCard>
	);
}
