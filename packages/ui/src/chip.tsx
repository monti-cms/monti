"use client";

import type * as React from "react";
import { cn } from "./cn";
import { FIELD_HOVER, FIELD_INSET } from "./hover";
import { Close } from "./icons";
import { useUiLabels } from "./labels";
import { ProposalNote } from "./proposal-cue";
import { Spark } from "./spark";

/** The pill of a chip, for parts that draw their own chip (a combobox's selected values). */
export const CHIP =
	"inline-flex h-monti-control-sm w-fit items-center gap-monti-6 rounded-monti-full bg-monti-selected px-monti-10 font-semibold text-monti-default text-monti-note whitespace-nowrap";

/** The small chip, one step under {@link CHIP}: a value inside a field (a tag), so it sits in the field's line without crowding it. */
export const CHIP_SM = "h-monti-control-xs gap-monti-4 px-monti-8 text-monti-caption";

/** What a chip's remove mark looks like: lighter than the text. */
export const CHIP_REMOVE =
	"flex shrink-0 cursor-pointer border-0 bg-transparent p-0 font-normal text-monti-subtle outline-none hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/20";

/**
 * The field that holds chips and the words being typed after them (a combobox of many, `TagInput`): an underline like `Input`, ink while it has
 * focus. One row stands as high as an `Input` (32px, or 28px with `data-size="sm"`); more chips wrap it downward.
 */
export const CHIPS_FIELD = cn(
	FIELD_HOVER,
	"flex min-h-monti-control-md flex-wrap items-center gap-monti-6 border-0 border-monti-default border-b bg-transparent py-monti-2 text-monti-body data-[size=sm]:min-h-monti-control-sm data-[size=sm]:py-px transition-colors focus-within:border-monti-contrast has-aria-invalid:border-monti-danger",
	FIELD_INSET,
);

/** The words being typed in a {@link CHIPS_FIELD}, after its chips. */
export const CHIPS_INPUT =
	"h-monti-control-xs min-w-16 flex-1 bg-transparent px-monti-2 outline-none placeholder:text-monti-faint";

/**
 * A condition that is on, or a value that was picked ("tag: React ×"). With `onRemove` it ends in a × that takes it off. `proposal` marks one the
 * assistant set and nobody has touched: a spark first, the proposal colors, and a × in the same blue. `size="sm"` is the small chip (24px, 12px
 * text) for values inside a field, such as tags; a list's filters keep the default size.
 */
function Chip({
	onRemove,
	removeLabel,
	proposal = false,
	size = "default",
	className,
	children,
	...props
}: React.ComponentProps<"span"> & {
	/** `sm` for a value inside a field (a tag); `default` elsewhere (a list's filter). */
	size?: "default" | "sm";
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
			data-size={size}
			className={cn(
				CHIP,
				size === "sm" && CHIP_SM,
				proposal && "bg-monti-proposal-muted text-monti-proposal",
				className,
			)}
			{...props}
		>
			{proposal && <Spark className="size-monti-icon-xs" />}
			<ProposalNote proposal={proposal} />
			{children}
			{onRemove && (
				<button
					type="button"
					aria-label={removeLabel ?? labels.deselect}
					onClick={onRemove}
					className={cn(CHIP_REMOVE, proposal && "text-monti-proposal hover:text-monti-proposal")}
				>
					<Close aria-hidden className="size-3" />
				</button>
			)}
		</span>
	);
}

export { Chip };
