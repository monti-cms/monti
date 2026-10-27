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
			className={cn("group/radio-group flex flex-col gap-monti-8", className)}
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
				"flex cursor-pointer items-start gap-monti-8 text-monti-label has-data-disabled:cursor-not-allowed has-data-disabled:opacity-50",
				"group-data-[variant=card]/radio-group:rounded-monti-md group-data-[variant=card]/radio-group:border group-data-[variant=card]/radio-group:border-monti-muted group-data-[variant=card]/radio-group:bg-monti-page group-data-[variant=card]/radio-group:px-monti-12 group-data-[variant=card]/radio-group:py-monti-8 group-data-[variant=card]/radio-group:has-data-checked:border-monti-contrast group-data-[variant=card]/radio-group:has-data-checked:bg-monti-selected",
				className,
			)}
		>
			<RadioPrimitive.Root
				value={value}
				disabled={disabled}
				className="mt-monti-2 flex size-monti-icon-md shrink-0 items-center justify-center rounded-monti-full border border-monti-default bg-monti-page outline-none hover:border-monti-emphasis focus-visible:ring-3 focus-visible:ring-monti-contrast/20 data-checked:border-monti-contrast"
			>
				<RadioPrimitive.Indicator className="size-2 rounded-monti-full bg-monti-emphasis" />
			</RadioPrimitive.Root>
			<span className="flex min-w-0 flex-col gap-monti-2">
				<span>{label}</span>
				{hint && <span className="text-monti-caption text-monti-muted">{hint}</span>}
			</span>
		</label>
	);
}

export { RadioGroup, RadioItem };
