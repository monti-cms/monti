"use client";

import type { ComponentProps } from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { Spark } from "./spark";
import { TextButton } from "./text-button";

const STEP =
	"cursor-pointer border-0 bg-transparent p-0 text-monti-muted outline-none hover:text-monti-default focus-visible:rounded-monti-sm focus-visible:ring-2 focus-visible:ring-monti-contrast/20 disabled:cursor-default disabled:opacity-45";

/**
 * The pill that floats over the status bar while proposals are waiting: the name of the request (a spark and the words, cut with … when long, so the source is clear even
 * with the panel closed; press it to open that conversation), "↑ 2 / 5 ↓" to step through the places the proposals touch, then discard all and accept
 * all. It holds nothing for the single proposal: accepting, discarding or asking again about one is in the card that opens from its mark.
 */
function ProposalBubble({
	name,
	onOpen,
	position,
	total,
	previousLabel,
	nextLabel,
	onPrevious,
	onNext,
	discardAllLabel,
	onDiscardAll,
	acceptAllLabel,
	onAcceptAll,
	className,
	...props
}: Omit<ComponentProps<"div">, "children"> & {
	/** The words of the request the proposals came from. */
	name: string;
	onOpen?: () => void;
	/** The proposal being looked at, from 1. */
	position: number;
	total: number;
	previousLabel: string;
	nextLabel: string;
	onPrevious: () => void;
	onNext: () => void;
	discardAllLabel: string;
	onDiscardAll: () => void;
	acceptAllLabel: string;
	onAcceptAll: () => void;
}) {
	const who = (
		<>
			<Spark className="size-monti-icon-sm" />
			<span title={name} className="max-w-60 truncate">
				{name}
			</span>
		</>
	);
	return (
		<div
			data-slot="proposal-bubble"
			role="group"
			className={cn(
				"inline-flex h-11 max-w-full items-center gap-monti-12 whitespace-nowrap rounded-monti-full border border-monti-emphasis bg-monti-page pr-monti-6 pl-monti-16 text-monti-body text-monti-default shadow-monti-floating",
				className,
			)}
			{...props}
		>
			{onOpen ? (
				<TextButton
					onClick={onOpen}
					className="inline-flex min-w-0 items-center gap-[7px] font-semibold text-monti-proposal"
				>
					{who}
				</TextButton>
			) : (
				<span className="inline-flex min-w-0 items-center gap-[7px] font-semibold text-monti-proposal">{who}</span>
			)}
			<span aria-hidden className="h-3.5 border-monti-default border-l" />
			<span className="inline-flex items-center gap-monti-6 font-mono text-monti-meta text-monti-muted">
				<button type="button" aria-label={previousLabel} className={STEP} disabled={total < 2} onClick={onPrevious}>
					↑
				</button>
				<span>
					{position} / {total}
				</span>
				<button type="button" aria-label={nextLabel} className={STEP} disabled={total < 2} onClick={onNext}>
					↓
				</button>
			</span>
			<TextButton variant="quiet" onClick={onDiscardAll}>
				{discardAllLabel}
			</TextButton>
			<Button size="sm" onClick={onAcceptAll}>
				{acceptAllLabel}
			</Button>
		</div>
	);
}

export { ProposalBubble };
