"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import * as React from "react";
import { cn } from "./cn";
import { Option, OptionContext } from "./option";

/**
 * One choice out of a few, as a column of `RadioItem` rows. Every row stands at a control's height, `md` (32px) unless `height` says `sm`, 4px apart, so a
 * row that holds a select or an input is as high as one that does not.
 */
function RadioGroup({ className, height = "md", ...props }: RadioGroupPrimitive.Props & { height?: "md" | "sm" }) {
	const outer = React.useContext(OptionContext);
	const rows = React.useMemo(() => ({ ...outer, height }), [outer, height]);
	return (
		<OptionContext value={rows}>
			<RadioGroupPrimitive
				data-slot="radio-group"
				data-height={height}
				className={cn("group/radio-group flex flex-col gap-monti-4", className)}
				{...props}
			/>
		</OptionContext>
	);
}

/**
 * An option row: the round mark (a filled ring when picked), the label and an optional note in mono ("148 posts"). A `control` (the select that says which
 * field the values move to) sits at the far end of the row.
 */
function RadioItem({
	value,
	label,
	hint,
	description,
	control,
	disabled,
	className,
}: {
	value: string;
	label: React.ReactNode;
	/** A short note in mono at the end of the row ("148 posts"). Text only: a longer note goes under the group. */
	hint?: string;
	/** A short plain note right after the label that says what the choice is ("Posts, notes: they have a body"): quiet, at the meta size. */
	description?: string;
	/** One small control that belongs to this choice, pushed to the end of the row (a select). Pressing it picks the row. */
	control?: React.ReactNode;
	disabled?: boolean;
	className?: string;
}) {
	return (
		<Option data-slot="radio-item" className={className}>
			<RadioPrimitive.Root
				value={value}
				disabled={disabled}
				className="size-3.5 shrink-0 rounded-monti-full border-[1.5px] border-monti-faint bg-transparent outline-none transition-[border-width,border-color] focus-visible:ring-2 focus-visible:ring-monti-contrast/50 data-checked:border-[4.5px] data-checked:border-monti-contrast"
			/>
			<span>{label}</span>
			{description && <span className="text-monti-meta text-monti-subtle">{description}</span>}
			{hint && <span className="font-mono text-monti-caption text-monti-subtle">{hint}</span>}
			{control && <span className="ml-auto">{control}</span>}
		</Option>
	);
}

export { RadioGroup, RadioItem };
