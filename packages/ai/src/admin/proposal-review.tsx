"use client";

import { ChevronLeft } from "@carbon/icons-react";
import { errorText, useAskPanel, useSite, useTranslator } from "@monti-cms/admin";
import {
	Button,
	Count,
	Del,
	EmptyState,
	Ins,
	PageColumn,
	PageHeader,
	Progress,
	ReviewCompare,
	ReviewCompareHead,
	ReviewGroup,
	ReviewItem,
	ReviewMore,
	ReviewQuote,
	Tabs,
	TabsList,
	TabsTrigger,
	Text,
	TextButton,
} from "@monti-cms/admin/kit";
import { AdminLink } from "@monti-cms/admin/router";
import { type ReactNode, useState } from "react";
import { proposalMessages } from "./proposal.messages";
import {
	fieldLabel,
	groupsOf,
	groupWords,
	type ProposalGroup,
	type ProposalItemView,
	reasonWords,
} from "./proposal-groups";
import { useProposal } from "./use-proposal";

/** Rows a long group shows before "N more". */
const FIRST_ROWS = 5;

const two = (n: number) => String(n).padStart(2, "0");
const dateOf = (iso: string) => {
	const at = new Date(iso);
	return `${two(at.getMonth() + 1)}. ${two(at.getDate())} ${two(at.getHours())}:${two(at.getMinutes())}`;
};
const textOf = (value: unknown): string | null =>
	value === null || value === undefined || value === ""
		? null
		: typeof value === "string"
			? value
			: JSON.stringify(value);

type Translate = (key: string, values?: Record<string, unknown>) => string;

/** The change of one item as "before → after", with the blue pencil on the two sides. */
function Change({ item, t }: { item: ProposalItemView; t: Translate }) {
	const before = textOf(item.shown?.before ?? item.preview.before);
	const after = textOf(item.shown?.after ?? item.preview.after);
	return (
		<>
			<Del>{before ?? t("review.empty")}</Del> → <Ins>{after ?? t("review.empty")}</Ins>
		</>
	);
}

/** What one row says at its end: the field, where it goes, or how it went. */
function useRowEnd() {
	const site = useSite();
	const t = useTranslator(proposalMessages) as unknown as Translate;
	const ask = useAskPanel();
	return (item: ProposalItemView, group: ProposalGroup): ReactNode => {
		if (item.state === "stale") {
			return (
				<>
					<Text variant="caption" tone="warning">
						{t("review.stale")}
					</Text>
					{ask && (
						<TextButton
							variant="underline"
							onClick={() => ask({ text: t("review.remakeRequest", { title: item.subject?.title ?? "" }) })}
						>
							{t("review.remake")}
						</TextButton>
					)}
				</>
			);
		}
		if (item.state === "failed") {
			return <Count tone="danger">{t("result.failed", { reason: reasonWords(site, item.reason) })}</Count>;
		}
		if (item.state === "kept") return <Count tone="warning">{t("result.kept")}</Count>;
		if (item.state === "reverted") return <Count>{t("result.reverted")}</Count>;
		if (item.state === "applied") {
			const words =
				group.operation === "entries.moveToFolder"
					? t("result.move", { folder: item.shown?.after ?? "" })
					: group.operation.endsWith(".trash")
						? t("result.trash")
						: t("result.field");
			return (
				<Text variant="meta" tone="success">
					{words}
				</Text>
			);
		}
		if (group.operation === "entries.moveToFolder") {
			return (
				<Count>{`${item.shown?.before ?? t("review.noFolder")} → ${item.shown?.after ?? t("review.noFolder")}`}</Count>
			);
		}
		if (group.operation.endsWith(".trash")) return <Count>{t("review.toTrash")}</Count>;
		if (group.operation === "entries.updateFields") {
			return <Count>{fieldLabel(site, item.subject?.collection, item.target.spot)}</Count>;
		}
		return null;
	};
}

/** One group of the review: its rows one line each, or side by side for text fields, with "Leave out all N" and "N more" for long groups. */
function Group({
	group,
	open,
	onInclude,
}: {
	group: ProposalGroup;
	/** The proposal waits for review: the checks can be changed. */
	open: boolean;
	onInclude: (changes: Record<string, boolean>) => void;
}) {
	const site = useSite();
	const t = useTranslator(proposalMessages) as unknown as Translate;
	const endOf = useRowEnd();
	const [side, setSide] = useState(false);
	const [all, setAll] = useState(false);
	const words = groupWords(site, group);
	const files = group.operation.startsWith("media.");
	const texts =
		(group.operation === "entries.updateFields" || group.operation === "media.updateText") &&
		group.items.every((item) => typeof item.preview.after === "string" || item.preview.after === null);
	const shown = all ? group.items : group.items.slice(0, FIRST_ROWS);
	const changeable = (item: ProposalItemView) => open && item.state === "pending";
	const includable = group.items.filter(changeable);
	return (
		<ReviewGroup
			title={words.name}
			meta={`${t(files ? "review.files" : "review.entries", { count: group.items.length })} · ${t("review.reversible")}`}
			actions={
				<>
					{texts && (
						<Tabs value={side ? "side" : "line"} onValueChange={(value) => setSide(value === "side")}>
							<TabsList>
								<TabsTrigger value="line">{t("review.lineView")}</TabsTrigger>
								<TabsTrigger value="side">{t("review.sideView")}</TabsTrigger>
							</TabsList>
						</Tabs>
					)}
					{includable.length > 1 && (
						<TextButton onClick={() => onInclude(Object.fromEntries(includable.map((item) => [item.id, false])))}>
							{t("review.excludeAll", { count: words.count })}
						</TextButton>
					)}
				</>
			}
		>
			{side && <ReviewCompareHead before={t("review.now")} after={t("review.proposed")} />}
			{shown.map((item) =>
				side ? (
					<ReviewCompare
						key={item.id}
						included={item.included && item.state !== "stale"}
						onIncludedChange={(included) => onInclude({ [item.id]: included })}
						includeLabel={t("review.include")}
						readOnly={!changeable(item)}
						label={item.subject?.title ?? ""}
						before={<Del>{textOf(item.preview.before) ?? t("review.empty")}</Del>}
						after={<Ins>{textOf(item.preview.after) ?? t("review.empty")}</Ins>}
					/>
				) : (
					<ReviewItem
						key={item.id}
						included={item.included && item.state !== "stale"}
						onIncludedChange={(included) => onInclude({ [item.id]: included })}
						includeLabel={t("review.include")}
						// A settled proposal keeps its checks as they were applied, and a change that moved meanwhile cannot be put back in.
						readOnly={!changeable(item)}
						title={item.subject?.title ?? item.target.id}
						path={item.subject?.path}
						end={endOf(item, group)}
						muted={item.state === "stale"}
					>
						{texts ? <Change item={item} t={t} /> : undefined}
					</ReviewItem>
				),
			)}
			{group.items.length > FIRST_ROWS && (
				<ReviewMore
					open={all}
					onOpenChange={setAll}
					moreLabel={t("review.more", {
						count: t(files ? "count.files" : "count.entries", { count: group.items.length - FIRST_ROWS }),
					})}
					lessLabel={t("review.less")}
				/>
			)}
		</ReviewGroup>
	);
}

/**
 * The review page of a proposal (flow 2 · 12–15, `/admin/ai/review/<id>`): the request quoted, then each group of changes with a check per change, one line
 * each or side by side. At the top right "Discard" and "Apply N"; while it applies, the progress; then how many were applied and failed, and "Undo all".
 * Items whose target changed since the plan are left out ("changed meanwhile") with "Make again".
 */
export function ProposalReviewScreen({ params }: { readonly params: readonly string[] }) {
	const site = useSite();
	const t = useTranslator(proposalMessages) as unknown as Translate;
	const id = params[0] ?? "";
	const proposal = useProposal(id);
	const { view, progress } = proposal;
	const back = (
		<TextButton variant="quiet" render={<AdminLink href={site.adminHref("/")} />}>
			<ChevronLeft aria-hidden />
			{t("review.back")}
		</TextButton>
	);
	if (!view) {
		return (
			<PageColumn>
				<PageHeader title={t("review.title")} trail={back} />
				{proposal.error ? (
					<EmptyState title={errorText(site, proposal.error, t("review.failed"))} />
				) : (
					<Text tone="subtle">{t("review.loading")}</Text>
				)}
			</PageColumn>
		);
	}
	const waiting = view.items.filter((item) => item.included && item.state === "pending").length;
	const applied = view.items.filter((item) => item.state === "applied").length;
	const failed = view.items.filter(
		(item) => item.included && (item.state === "failed" || item.state === "stale"),
	).length;
	const open = view.status === "pending" && !progress;
	const actions = progress ? (
		<Text variant="note" tone="muted" role="status">
			{t("review.applying")} <Count>{`${progress.done} / ${progress.total}`}</Count>
			<Progress
				value={progress.total ? (progress.done / progress.total) * 100 : 0}
				label={t("review.progress")}
				inline
			/>
		</Text>
	) : view.status === "pending" ? (
		<>
			<TextButton variant="quiet" onClick={() => void proposal.discard()}>
				{t("discard")}
			</TextButton>
			<Button onClick={() => void proposal.apply()} disabled={waiting === 0}>
				{t("apply", { count: waiting })}
			</Button>
		</>
	) : view.status === "applied" || view.status === "partial" ? (
		<>
			<Text variant="note" tone="success" role="status">
				{t("applied", { count: applied })}
			</Text>
			{failed > 0 && (
				<Text variant="note" tone="danger">
					{t("failed", { count: failed })}
				</Text>
			)}
			<Button variant="secondary" onClick={() => void proposal.revert()}>
				{t("undo")}
			</Button>
		</>
	) : (
		<Text variant="note" tone="subtle">
			{view.status === "reverted" ? t("status.reverted", { time: "" }).replace(/ · $/, "") : t("status.discarded")}
		</Text>
	);
	return (
		<PageColumn data-testid="proposal-review">
			<PageHeader title={t("review.title")} meta={dateOf(view.createdAt)} trail={back}>
				{actions}
			</PageHeader>
			<ReviewQuote>“{view.request}”</ReviewQuote>
			{groupsOf(view).map((group) => (
				<Group key={group.key} group={group} open={open} onInclude={(changes) => void proposal.include(changes)} />
			))}
		</PageColumn>
	);
}
