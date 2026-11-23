"use client";

import type * as React from "react";
import { cn } from "./cn";
import { HIT_AREA } from "./hit-area";
import { FIELD_HOVER, FIELD_INSET } from "./hover";
import { Close } from "./icons";
import { useUiLabels } from "./labels";
import { ProposalNote } from "./proposal-cue";
import { Spark } from "./spark";

/**
 * The look of a chip, for parts that draw their own chip (a combobox's selected values): 24px, `radius-sm`, the selected ground, 13px words at 400, 8px
 * at the sides (4px after a ×).
 */
export const CHIP =
	"inline-flex h-monti-control-xs w-fit items-center gap-monti-4 rounded-monti-sm bg-monti-selected px-monti-8 has-[>button]:pr-monti-4 font-normal text-monti-default text-monti-note whitespace-nowrap";

/** The small chip: the same 24px with 12px words and 6px at the sides, for a value inside a field (a tag), so it sits in the field's line without crowding it. */
export const CHIP_SM = "h-monti-control-xs gap-monti-2 px-monti-6 text-monti-caption";

/** What a chip's remove mark looks like: lighter than the text. */
export const CHIP_REMOVE = `${HIT_AREA} flex shrink-0 cursor-pointer rounded-monti-sm border-0 bg-transparent p-0 font-normal text-monti-faint outline-none hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/60`;

/**
 * A chip that can be taken off answers as a whole, as most systems' chips do: one step darker under the pointer, one more while its × is pressed. The ×
 * only turns ink; the keyboard's ring runs around the × alone, the one thing in it that can be pressed.
 */
export const CHIP_REMOVABLE = "hover:bg-monti-current has-[>button:active]:bg-monti-emphasis/20";

/**
 * The field that holds chips and the words being typed after them (a combobox of many, `TagInput`): an underline like `Input`, ink while it has
 * focus. The field's tint stays off while the pointer is on a chip (the chip is what answers then). One row stands as high as an `Input` (36px, 32px with `data-size="md"`, 28px with `"sm"`); more chips wrap it downward.
 */
export const CHIPS_FIELD = cn(
	FIELD_HOVER,
	"has-[[data-slot=chip]:hover,[data-slot=combobox-chip]:hover]:border-transparent! has-[[data-slot=chip]:hover,[data-slot=combobox-chip]:hover]:bg-transparent! flex min-h-monti-control-md flex-wrap items-center gap-monti-6 border-0 border-transparent border-b bg-transparent py-monti-2 text-monti-body data-[size=md]:min-h-monti-control-md data-[size=sm]:min-h-monti-control-sm data-[size=sm]:py-px transition-colors focus-within:border-monti-contrast has-aria-invalid:border-monti-danger",
	FIELD_INSET,
);

/** The words being typed in a {@link CHIPS_FIELD}, after its chips. */
export const CHIPS_INPUT =
	"h-monti-control-xs min-w-16 flex-1 bg-transparent px-monti-2 outline-none placeholder:text-monti-faint";

/**
 * A condition that is on, or a value that was picked ("tag: React ×"). With `onRemove` it ends in a × that takes it off. `proposal` marks one the
 * assistant set and nobody has touched: a spark first, the proposal colors, and a × in the same blue. Both sizes are 24px; `size="sm"` has 12px
 * text for values inside a field, such as tags; a list's filters keep the default size.
 */
function Chip({
	onRemove,
	removeLabel,
	proposal = false,
	disabled = false,
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
	/** Cannot be taken off now: faint, with no × and no answer to the pointer. */
	disabled?: boolean;
}) {
	const labels = useUiLabels();
	return (
		<span
			data-slot="chip"
			data-proposal={proposal || undefined}
			data-size={size}
			data-disabled={disabled || undefined}
			className={cn(
				CHIP,
				size === "sm" && CHIP_SM,
				onRemove && !disabled && CHIP_REMOVABLE,
				disabled && "opacity-45",
				proposal && "bg-monti-proposal-muted text-monti-proposal",
				className,
			)}
			{...props}
		>
			{proposal && <Spark className="size-monti-icon-xs" />}
			<ProposalNote proposal={proposal} />
			{children}
			{onRemove && !disabled && (
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
