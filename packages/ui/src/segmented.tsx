"use client";

import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import type { ReactNode } from "react";
import { cn } from "./cn";

type SegmentedOption<T extends string> = {
	value: T;
	label: ReactNode;
	/** The name for screen readers when `label` is only an icon. */
	"aria-label"?: string;
};

/**
 * A short choice of one among a few (every language the same / per language / follow the source): joined cells in a thin rounded frame, the
 * picked cell on the selected background and 600 (`value={null}` while none is picked yet). `size="sm"` for panels and filter rows; `inline` makes it as wide as its cells instead of
 * its container.
 */
function Segmented<T extends string>({
	value,
	onValueChange,
	options,
	size = "md",
	inline = false,
	disabled,
	"aria-label": ariaLabel,
}: {
	value: T | null;
	onValueChange: (value: T) => void;
	options: readonly SegmentedOption<T>[];
	size?: "md" | "sm";
	inline?: boolean;
	disabled?: boolean;
	"aria-label"?: string;
}) {
	return (
		<ToggleGroup
			data-slot="segmented"
			aria-label={ariaLabel}
			disabled={disabled}
			value={value === null ? [] : [value]}
			onValueChange={(next) => {
				// Pressing the picked cell would clear it; once a cell is picked, one stays picked.
				const picked = next[0];
				if (picked !== undefined) onValueChange(picked as T);
			}}
			className={cn(
				"flex overflow-hidden rounded-monti-lg border border-monti-default",
				size === "sm" ? "text-monti-caption" : "text-monti-note",
				inline && "w-fit",
			)}
		>
			{options.map((option) => (
				<Toggle
					key={option.value}
					value={option.value}
					aria-label={option["aria-label"]}
					className={cn(
						"flex items-center justify-center whitespace-nowrap border-0 bg-transparent px-monti-4 text-center text-monti-muted outline-none transition-colors hover:text-monti-default focus-visible:bg-monti-muted disabled:opacity-45 data-pressed:bg-monti-selected data-pressed:font-semibold data-pressed:text-monti-default",
						inline ? "flex-none px-monti-10" : "flex-1",
						// The design system's `sm` is 12px type on a 20px line with 5px above and below, 32px tall. The role's 16px line takes 7px to be as tall.
						"py-[7px]",
						// A cell holding only an icon is as tall as one holding text (14px of padding and the role's 20px line), so a row of icons is 36px, like the others.
						size === "md" && "min-h-[34px]",
					)}
				>
					{option.label}
				</Toggle>
			))}
		</ToggleGroup>
	);
}

export { Segmented };
export type { SegmentedOption };
