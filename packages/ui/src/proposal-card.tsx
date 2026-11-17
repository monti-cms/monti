import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

const FOOT = "flex items-center gap-monti-12 border-monti-default border-t px-monti-16 py-monti-10 text-monti-note";

/**
 * A proposal in the conversation, as a frame: the head says what it is and how much ("Proposal · 4 groups · 19"), then its changes, then the
 * foot. The changes are rows of the shared `Table`, the same rows as on the proposal's review page without their checks. The foot is the one
 * place that says where the proposal stands and holds what can be done with all of it (review, discard and apply; how far an apply is; how
 * many were applied and "Undo"; that it was undone or discarded): the head carries no status. A discarded proposal is `muted`.
 */
function ProposalCard({
	title,
	summary,
	muted = false,
	footer,
	className,
	children,
	...props
}: Omit<ComponentProps<"section">, "title"> & {
	title: ReactNode;
	/** How much it changes ("4 groups · 19"). */
	summary?: ReactNode;
	/** Discarded: the card is faint. */
	muted?: boolean;
	footer?: ReactNode;
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
			<div className="flex items-center gap-monti-8 px-monti-16 py-monti-10">
				<b className="font-semibold text-monti-label">{title}</b>
				{summary !== undefined && <span className="text-monti-micro text-monti-subtle">{summary}</span>}
			</div>
			{children}
			{footer && <div className={FOOT}>{footer}</div>}
		</section>
	);
}

export { ProposalCard };
