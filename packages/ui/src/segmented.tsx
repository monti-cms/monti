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
 * A short choice of one among a few (every language the same / per language / follow the source, a view switch): joined cells on a muted frame
 * (`radius-md`, 2px inside), the picked cell lifted onto the page ground with a `border-default` line, in ink and 500 (`value={null}` while none is
 * picked yet). Cells are `radius-sm`, so the shape tells it apart from the underline tabs. It stands at a control's height, frame included: `md` 32px
 * (13px words), `sm` 28px (12px words) for filter rows and tight panels. `inline` makes it as wide as its cells instead of its container. On the
 * tool ground (`tone="tool"`, the sidebar's theme switch) the cells off the pick are faint and take the selected ground under the pointer.
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
				"flex overflow-hidden rounded-monti-md bg-monti-muted p-[2px]",
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
						"flex items-center justify-center whitespace-nowrap rounded-monti-sm border-0 bg-transparent px-monti-4 text-center text-monti-subtle outline-none transition-colors hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/60 focus-visible:ring-inset disabled:opacity-45 data-pressed:font-medium data-pressed:text-monti-default",
						tone === "tool"
							? "not-data-pressed:text-monti-faint not-data-pressed:hover:bg-monti-selected data-pressed:bg-monti-page data-pressed:shadow-[0_0_0_1px_var(--monti-border-default)]"
							: "data-pressed:bg-monti-page data-pressed:shadow-[0_0_0_1px_var(--monti-border-default)]",
						inline ? "flex-none px-monti-12" : "flex-1",
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
