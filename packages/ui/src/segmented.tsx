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
 * picked cell on the selected background and 600 (`value={null}` while none is picked yet). It stands at a control's height, frame included: `md` 32px
 * (13px words), `sm` 28px (12px words) for filter rows and tight panels. `inline` makes it as wide as its cells instead of its container.
 */
function Segmented<T extends string>({
	value,
	onValueChange,
	options,
	size = "md",
	tone = "default",
	inline = false,
	disabled,
	"aria-label": ariaLabel,
}: {
	value: T | null;
	onValueChange: (value: T) => void;
	options: readonly SegmentedOption<T>[];
	/** `md` 32px, `sm` 28px, frame included. */
	size?: "md" | "sm";
	/** `tool` on a tool surface (the sidebar), where the selected ground is the hover: a cell under the pointer takes it and the pressed cell takes the current ground. */
	tone?: "default" | "tool";
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
				size === "sm" ? "h-monti-control-sm text-monti-caption" : "h-monti-control-md text-monti-note",
				inline && "w-fit",
			)}
		>
			{options.map((option) => (
				<Toggle
					key={option.value}
					value={option.value}
					aria-label={option["aria-label"]}
					className={cn(
						"flex items-center justify-center whitespace-nowrap border-0 bg-transparent px-monti-4 text-center text-monti-muted outline-none transition-colors hover:text-monti-default focus-visible:bg-monti-muted disabled:opacity-45 data-pressed:font-semibold data-pressed:text-monti-default",
						tone === "tool"
							? "not-data-pressed:hover:bg-monti-selected data-pressed:bg-monti-current"
							: "data-pressed:bg-monti-selected",
						inline ? "flex-none px-monti-10" : "flex-1",
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
