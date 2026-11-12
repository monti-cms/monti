import type { ProposalView } from "@monti-cms/core";
import { Button, Count, Inline, Progress, Text } from "@monti-cms/ui";
import { useAdmin } from "../operations/admin-context";
import { type ProposalStanding, standingOf } from "./use-proposal";

/**
 * Where a proposal stands and what can be done with all of it, in one row: the card's foot in the conversation and the end of the review page's
 * head are this same row, so the two never say it differently. Waiting: "Review" (on the card), "Discard" and the pill with how many it
 * applies. Being applied: how far. Applied: how many, how many could not be, and "Undo". Then only that it was undone or discarded.
 */
export function ProposalState({
	view,
	applying,
	progress,
	size,
	busy,
	onReview,
	onDiscard,
	onApply,
	onRevert,
}: {
	view: ProposalView;
	applying: boolean;
	progress: { done: number; total: number } | null;
	/** `sm` in the card; the page's own size at the end of a page's head. */
	size?: "sm";
	busy: boolean;
	/** On the card: the way to the review page. */
	onReview?: () => void;
	onDiscard: () => void;
	onApply: () => void;
	onRevert: () => void;
}) {
	const { t } = useAdmin();
	const standing: ProposalStanding = standingOf(view, applying);
	const { counts } = view;
	if (standing === "applying")
		return (
			<Inline gap={12} align="center" grow justify="end">
				<Text variant="note">{t("card.applying")}</Text>
				{progress ? (
					<>
						<Count>
							{progress.done} / {progress.total}
						</Count>
						<Progress
							inline
							value={progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100)}
							label={t("card.applying")}
						/>
					</>
				) : null}
			</Inline>
		);
	if (standing === "waiting")
		return (
			<Inline gap={12} align="center" grow>
				{onReview ? (
					<Button variant="ghost" size={size} onClick={onReview}>
						{t("card.review")}
					</Button>
				) : null}
				<Inline gap={12} align="center" grow justify="end">
					<Button variant="ghost" size={size} onClick={onDiscard} disabled={busy}>
						{t("card.discard")}
					</Button>
					{/* Nothing kept in: the pill says so with its count, and there is nothing to press. */}
					<Button variant="primary" size={size} onClick={onApply} disabled={counts.toApply === 0 || busy}>
						{t("card.apply", { count: counts.toApply })}
					</Button>
				</Inline>
			</Inline>
		);
	if (standing === "applied")
		return (
			<Inline gap={12} align="center" grow>
				<Text variant="note" tone="success">
					{t("card.applied", { count: counts.applied })}
				</Text>
				{counts.failed > 0 ? (
					<Text variant="note" tone="danger">
						{t("card.failed", { count: counts.failed })}
					</Text>
				) : null}
				<Inline gap={12} align="center" grow justify="end">
					{onReview ? (
						<Button variant="ghost" size={size} onClick={onReview}>
							{t("card.review")}
						</Button>
					) : null}
					{counts.applied > 0 ? (
						<Button variant={size === "sm" ? "ghost" : "secondary"} size={size} onClick={onRevert} disabled={busy}>
							{t("card.revert")}
						</Button>
					) : null}
				</Inline>
			</Inline>
		);
	return (
		<Text variant="note" tone="subtle">
			{t(standing === "reverted" ? "card.reverted" : "card.discarded")}
		</Text>
	);
}
