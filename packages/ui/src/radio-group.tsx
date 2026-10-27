"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import type * as React from "react";
import { cn } from "./cn";
import { Option } from "./option";

/** One choice out of a few, as a column of `RadioItem` rows. */
function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
	return (
		<RadioGroupPrimitive
			data-slot="radio-group"
			className={cn("group/radio-group flex flex-col gap-monti-12", className)}
			{...props}
		/>
	);
}

/** An option row: the round mark (a filled ring when picked), the label and an optional note in mono ("148 posts"). */
function RadioItem({
	value,
	label,
	hint,
	disabled,
	className,
}: {
	value: string;
	label: React.ReactNode;
	/** A short note in mono at the end of the row ("148 posts"). Text only, never a control: a control or a longer note goes under the group, not in the row. */
	hint?: string;
	disabled?: boolean;
	className?: string;
}) {
	return (
		<Option data-slot="radio-item" className={className}>
			<RadioPrimitive.Root
				value={value}
				disabled={disabled}
				className="size-3.5 shrink-0 rounded-monti-full border-[1.5px] border-monti-faint bg-transparent outline-none transition-[border-width,border-color] focus-visible:ring-3 focus-visible:ring-monti-contrast/20 data-checked:border-[4.5px] data-checked:border-monti-contrast"
			/>
			<span>{label}</span>
			{hint && <span className="font-mono text-monti-caption text-monti-subtle">{hint}</span>}
		</Option>
	);
}

export { RadioGroup, RadioItem };
