import type { ProposalView } from "@monti-cms/core";
import { Button, Count, Inline, Progress, Text } from "@monti-cms/ui";
import type { ReactNode } from "react";
import { useAdmin } from "../operations/admin-context";
import { nextStop, useFocusHandOff } from "../screens/frame/focus-hand-off";
import { type ProposalStanding, standingOf } from "./use-proposal";

/** How long the row's buttons take no press after the row changed: longer than a double press, shorter than a person deciding. */
const SETTLE_MS = 400;
/** Where each proposal stood when its row was last drawn, and when that last changed. */
const MOVED = new Map<string, { standing: ProposalStanding; at: number }>();

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
	// A button of the row pressed with the keyboard goes as the proposal moves on (applying has none, discarded has none). The focus goes to
	// the first button the row still has, else to the first control after the row: one rule on the card and on the page.
	const handed = useFocusHandOff((row) =>
		// The row itself going (the page it is on was left) hands nothing on: what takes the page's place has its own first control.
		row.contains(document.activeElement)
			? null
			: (row.querySelector<HTMLElement>("button:not(:disabled), a[href]") ?? nextStop(row)),
	);
	// A press meant for the button that was here lands on the one that took its place (a second press on "apply" came down on "undo",
	// which stands at the same spot the moment the apply is over): for a short while after the proposal moves on, the row's buttons
	// take no press. Kept by the proposal, not by this row: the card and the page draw the row anew as they read the proposal again,
	// and a row that is only drawn again has not changed.
	const before = MOVED.get(view.id);
	if (before?.standing !== standing) MOVED.set(view.id, { standing, at: before ? performance.now() : 0 });
	const settled = (press: () => void) => () => {
		if (performance.now() - (MOVED.get(view.id)?.at ?? 0) >= SETTLE_MS) press();
	};
	// One box for every state, so the row itself stays while its buttons come and go.
	const row = (content: ReactNode) => (
		<Inline ref={handed} gap={12} align="center" grow>
			{content}
		</Inline>
	);
	if (standing === "applying")
		return row(
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
			</Inline>,
		);
	if (standing === "waiting")
		return row(
			<>
				{onReview ? (
					<Button variant="ghost" size={size} onClick={settled(onReview)}>
						{t("card.review")}
					</Button>
				) : null}
				<Inline gap={12} align="center" grow justify="end">
					<Button variant="ghost" size={size} onClick={settled(onDiscard)} disabled={busy}>
						{t("card.discard")}
					</Button>
					{/* Nothing kept in: the pill says so with its count, and there is nothing to press. */}
					<Button variant="primary" size={size} onClick={settled(onApply)} disabled={counts.toApply === 0 || busy}>
						{t("card.apply", { count: counts.toApply })}
					</Button>
				</Inline>
			</>,
		);
	if (standing === "applied")
		return row(
			<>
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
						<Button variant="ghost" size={size} onClick={settled(onReview)}>
							{t("card.review")}
						</Button>
					) : null}
					{counts.applied > 0 ? (
						<Button
							variant={size === "sm" ? "ghost" : "secondary"}
							size={size}
							onClick={settled(onRevert)}
							disabled={busy}
						>
							{t("card.revert")}
						</Button>
					) : null}
				</Inline>
			</>,
		);
	return row(
		<Text variant="note" tone="subtle">
			{t(standing === "reverted" ? "card.reverted" : "card.discarded")}
		</Text>,
	);
}
