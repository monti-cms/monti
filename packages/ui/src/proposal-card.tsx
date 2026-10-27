import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { Count } from "./count";
import { TextButton } from "./text-button";

/**
 * A proposal in the conversation: the head says what will change and how much ("Proposal · Fill summary · 2 posts") and that it waits for review;
 * under it one `ProposalItem` per place, with the blue pencil on what changes; at the bottom review (goes to the places), discard and a black Apply.
 * Once applied, the bottom line says so with the time and a way back (`appliedLabel`, `undoLabel`).
 */
function ProposalCard({
	title,
	summary,
	status,
	reviewLabel,
	onReview,
	discardLabel,
	onDiscard,
	applyLabel,
	onApply,
	appliedLabel,
	undoLabel,
	onUndo,
	className,
	children,
	...props
}: Omit<ComponentProps<"section">, "title"> & {
	title: string;
	/** What it does, and where ("Fill summary · 2 posts"). */
	summary?: string;
	/** Where it stands ("Waiting for review"). */
	status?: string;
	reviewLabel: string;
	onReview: () => void;
	discardLabel: string;
	onDiscard: () => void;
	applyLabel: string;
	onApply: () => void;
	/** Set once the proposal is applied: the line that replaces the buttons ("Applied to 2 posts · 10:52"). */
	appliedLabel?: string;
	undoLabel?: string;
	onUndo?: () => void;
	children: ReactNode;
}) {
	return (
		<section
			data-slot="proposal-card"
			data-applied={appliedLabel ? "" : undefined}
			className={cn("overflow-hidden rounded-monti-xl border border-monti-default bg-monti-page", className)}
			{...props}
		>
			<div className="flex items-center gap-monti-8 px-[14px] py-monti-10">
				<b className="font-semibold text-monti-label">{title}</b>
				{summary && <Count>{summary}</Count>}
				<span className="grow" />
				{status && <span className="text-monti-caption text-monti-warning">{status}</span>}
			</div>
			<div className="flex flex-col gap-monti-10 border-monti-muted border-t px-[14px] py-monti-12 text-monti-note">
				{children}
			</div>
			<div className="flex items-center gap-monti-16 border-monti-default border-t px-[14px] py-monti-10 text-monti-note">
				{appliedLabel ? (
					<>
						<span className="flex items-center gap-monti-6 text-monti-muted">
							<Check aria-hidden className="size-3.5 text-monti-success" />
							{appliedLabel}
						</span>
						<span className="grow" />
						{undoLabel && (
							<TextButton variant="underline" onClick={onUndo}>
								{undoLabel}
							</TextButton>
						)}
					</>
				) : (
					<>
						<TextButton variant="underline" onClick={onReview}>
							{reviewLabel}
						</TextButton>
						<span className="grow" />
						<TextButton variant="quiet" onClick={onDiscard}>
							{discardLabel}
						</TextButton>
						<Button size="sm" onClick={onApply}>
							{applyLabel}
						</Button>
					</>
				)}
			</div>
		</section>
	);
}

/** One place the proposal changes: its name in bold, and under it the text with `Ins` and `Del` marks. */
function ProposalItem({ title, children }: { title: ReactNode; children: ReactNode }) {
	return (
		<div data-slot="proposal-item" className="flex flex-col">
			<b className="font-semibold">{title}</b>
			<span>{children}</span>
		</div>
	);
}

export { ProposalCard, ProposalItem };
