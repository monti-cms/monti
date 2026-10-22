"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import type * as React from "react";
import { cn } from "./cn";

/** One choice out of a few. `variant="card"` draws each option as a bordered row with a hint (an export scope, a key to use). */
function RadioGroup({
	className,
	variant = "plain",
	...props
}: RadioGroupPrimitive.Props & { variant?: "plain" | "card" }) {
	return (
		<RadioGroupPrimitive
			data-slot="radio-group"
			data-variant={variant}
			className={cn("group/radio-group flex flex-col gap-condensed", className)}
			{...props}
		/>
	);
}

/** An option: the round mark, a label and an optional hint. Clicking the label picks it. */
function RadioItem({
	value,
	label,
	hint,
	disabled,
	className,
}: {
	value: string;
	label: React.ReactNode;
	hint?: React.ReactNode;
	disabled?: boolean;
	className?: string;
}) {
	return (
		<label
			data-slot="radio-item"
			className={cn(
				"flex cursor-pointer items-start gap-condensed text-monti-label has-data-disabled:cursor-not-allowed has-data-disabled:opacity-50",
				"group-data-[variant=card]/radio-group:rounded-md group-data-[variant=card]/radio-group:border group-data-[variant=card]/radio-group:border-monti-muted group-data-[variant=card]/radio-group:px-normal group-data-[variant=card]/radio-group:py-condensed group-data-[variant=card]/radio-group:has-data-checked:border-monti-focus group-data-[variant=card]/radio-group:has-data-checked:bg-monti-accent-muted",
				className,
			)}
		>
			<RadioPrimitive.Root
				value={value}
				disabled={disabled}
				className="mt-hair flex size-icon shrink-0 items-center justify-center rounded-full border border-monti-default outline-none focus-visible:ring-3 focus-visible:ring-monti-focus-soft data-checked:border-monti-accent"
			>
				<RadioPrimitive.Indicator className="size-2 rounded-full bg-monti-accent-emphasis" />
			</RadioPrimitive.Root>
			<span className="flex min-w-0 flex-col gap-hair">
				<span>{label}</span>
				{hint && <span className="text-monti-caption text-monti-muted">{hint}</span>}
			</span>
		</label>
	);
}

export { RadioGroup, RadioItem };
