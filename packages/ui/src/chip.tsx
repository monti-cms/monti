"use client";

import { X } from "lucide-react";
import type * as React from "react";
import { Spark } from "./ai-action";
import { cn } from "./cn";
import { useUiLabels } from "./labels";
import { ProposalNote } from "./proposal-cue";

/** The pill of a chip, for parts that draw their own chip (a combobox's selected values). */
export const CHIP =
	"inline-flex h-monti-control-sm w-fit items-center gap-monti-6 rounded-monti-full bg-monti-selected px-monti-10 pb-[2px] font-semibold text-monti-default text-monti-note whitespace-nowrap";

/** What a chip's remove mark looks like: lighter than the text. */
export const CHIP_REMOVE =
	"flex shrink-0 cursor-pointer border-0 bg-transparent p-0 font-normal text-monti-subtle outline-none hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/20";

/**
 * A condition that is on, or a value that was picked ("tag: React ×"). With `onRemove` it ends in a × that takes it off. `proposal` marks one the
 * assistant set and nobody has touched: a spark first, the proposal colors, and a × in the same blue.
 */
function Chip({
	onRemove,
	removeLabel,
	proposal = false,
	className,
	children,
	...props
}: React.ComponentProps<"span"> & {
	/** Adds the × that takes the chip off. */
	onRemove?: () => void;
	/** The name of the ×, for screen readers. */
	removeLabel?: string;
	/** The assistant set this and nobody has touched it yet. Turn it off when it is changed. */
	proposal?: boolean;
}) {
	const labels = useUiLabels();
	return (
		<span
			data-slot="chip"
			data-proposal={proposal || undefined}
			className={cn(CHIP, proposal && "bg-monti-proposal-muted text-monti-proposal", className)}
			{...props}
		>
			{proposal && <Spark />}
			<ProposalNote proposal={proposal} />
			{children}
			{onRemove && (
				<button
					type="button"
					aria-label={removeLabel ?? labels.deselect}
					onClick={onRemove}
					className={cn(CHIP_REMOVE, proposal && "text-monti-proposal hover:text-monti-proposal")}
				>
					<X aria-hidden className="size-3" />
				</button>
			)}
		</span>
	);
}

export { Chip };
