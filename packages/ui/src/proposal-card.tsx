import type { ComponentProps, ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { TextButton } from "./text-button";

const ROW = "flex items-baseline gap-monti-8 border-monti-muted border-t px-[14px] py-monti-10 text-monti-note";
const FOOT = "flex items-center gap-[14px] border-monti-default border-t px-[14px] py-monti-10 text-monti-note";

/**
 * A proposal in the conversation: the head says what it is and how much ("Proposal · 4 groups · 19") and where it stands ("Waiting for review"), then one row per group of
 * changes, then the foot with what can be done (`ProposalActions` while it waits, `ProposalResult` once applied). `after` holds rows under the foot (the
 * items that could not be applied, with their reason). A discarded proposal is `muted`.
 */
function ProposalCard({
	title,
	summary,
	status,
	statusTone = "warning",
	muted = false,
	footer,
	after,
	className,
	children,
	...props
}: Omit<ComponentProps<"section">, "title"> & {
	title: ReactNode;
	/** How much it changes ("4 groups · 19"). */
	summary?: ReactNode;
	/** Where it stands ("Waiting for review", "Applied", "Discarded"). */
	status?: ReactNode;
	statusTone?: "warning" | "success" | "subtle";
	/** Discarded: the card is faint. */
	muted?: boolean;
	footer?: ReactNode;
	after?: ReactNode;
	children?: ReactNode;
}) {
	return (
		<section
			data-slot="proposal-card"
			data-muted={muted || undefined}
			className={cn(
				"overflow-hidden rounded-monti-xl border border-monti-default bg-monti-page text-monti-default data-muted:opacity-60",
				className,
			)}
			{...props}
		>
			<div className="flex items-center gap-monti-8 px-[14px] py-monti-10">
				<b className="font-bold text-monti-label">{title}</b>
				{summary !== undefined && <span className="text-monti-micro text-monti-subtle">{summary}</span>}
				<span className="grow" />
				{status !== undefined && (
					<span
						className={cn(
							"font-medium text-monti-caption",
							statusTone === "warning" && "text-monti-warning",
							statusTone === "success" && "text-monti-success",
							statusTone === "subtle" && "text-monti-subtle",
						)}
					>
						{status}
					</span>
				)}
			</div>
			{children}
			{footer && <div className={FOOT}>{footer}</div>}
			{after}
		</section>
	);
}

/** One group of changes in a card: its name in bold, where (subtle), and how many at the end in mono ("Tidy · Edited after publishing · 3 places"). */
function ProposalRow({
	name,
	detail,
	count,
	tone = "default",
}: {
	name: ReactNode;
	detail?: ReactNode;
	count?: ReactNode;
	/** `danger` for an item that could not be applied ("Not moved"). */
	tone?: "default" | "danger";
}) {
	return (
		<div data-slot="proposal-row" className={ROW}>
			<span className={cn("font-semibold", tone === "danger" && "font-normal text-monti-danger")}>{name}</span>
			{detail !== undefined && <span className={cn(tone === "default" && "text-monti-subtle")}>{detail}</span>}
			<span className="grow" />
			{count !== undefined && <span className="text-monti-micro text-monti-subtle">{count}</span>}
		</div>
	);
}

/** One change shown as its new text: what it is for in mono (a file name), and the text with its `Ins` and `Del` marks under it. */
function ProposalItem({ title, children }: { title: ReactNode; children: ReactNode }) {
	return (
		<div data-slot="proposal-item" className={cn(ROW, "flex-col items-stretch gap-monti-4")}>
			<span className="font-mono text-monti-faint text-monti-meta">{title}</span>
			<span>{children}</span>
		</div>
	);
}

/** The foot of a waiting proposal: "Details" (when there is a review screen), then "Discard" and the black apply pill with its count. */
function ProposalActions({
	reviewLabel,
	onReview,
	discardLabel,
	onDiscard,
	applyLabel,
	onApply,
	busy = false,
}: {
	reviewLabel?: string;
	onReview?: () => void;
	discardLabel: string;
	onDiscard: () => void;
	applyLabel: string;
	onApply: () => void;
	/** Applying: the pill shows it works and nothing can be pressed. */
	busy?: boolean;
}) {
	return (
		<>
			{reviewLabel && onReview && (
				<TextButton variant="underline" onClick={onReview}>
					{reviewLabel}
				</TextButton>
			)}
			<span className="grow" />
			<TextButton variant="quiet" onClick={onDiscard} disabled={busy}>
				{discardLabel}
			</TextButton>
			<Button size="sm" onClick={onApply} loading={busy}>
				{applyLabel}
			</Button>
		</>
	);
}

/** The foot of an applied proposal: how many were applied ✓, how many could not be, when, and "Undo all" (or that it was undone). */
function ProposalResult({
	appliedLabel,
	failedLabel,
	time,
	undoLabel,
	onUndo,
	busy = false,
}: {
	appliedLabel: ReactNode;
	failedLabel?: ReactNode;
	time?: ReactNode;
	undoLabel?: string;
	onUndo?: () => void;
	busy?: boolean;
}) {
	return (
		<>
			<span className="text-monti-success">{appliedLabel}</span>
			{failedLabel !== undefined && <span className="text-monti-danger">{failedLabel}</span>}
			{time !== undefined && <span className="text-monti-micro text-monti-subtle">{time}</span>}
			<span className="grow" />
			{undoLabel && onUndo && (
				<TextButton variant="underline" onClick={onUndo} disabled={busy}>
					{undoLabel}
				</TextButton>
			)}
		</>
	);
}

export { ProposalActions, ProposalCard, ProposalItem, ProposalResult, ProposalRow };
