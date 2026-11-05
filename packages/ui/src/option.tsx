import type * as React from "react";
import { cn } from "./cn";

/**
 * A row of a choice: a control (checkbox, radio, switch), its text and, if needed, a note. Pressing the text presses the control.
 * `spread` pushes the control to the far end of the row, the way a switch row reads ("Put the language in the preview path ⬤").
 * `height` gives the row a control's height, so rows holding a switch, an input and a select stand at one even spacing (a field sheet's input rules: `md`).
 */
function Option({
	spread = false,
	height,
	className,
	...props
}: React.ComponentProps<"label"> & {
	/** The control sits at the far end, the text at the start. */
	spread?: boolean;
	/** The row's height: that of a control of this size (`md` 32px, `sm` 28px). */
	height?: "md" | "sm";
}) {
	return (
		<label
			data-slot="option"
			className={cn(
				"[&:hover_[data-slot=checkbox]:not([data-disabled]):not([data-checked])]:border-(color:--monti-fg-muted) flex cursor-pointer items-center gap-monti-10 text-monti-body has-data-disabled:cursor-not-allowed has-disabled:cursor-not-allowed has-data-disabled:opacity-45 [&:hover_[data-slot=checkbox]:not([data-disabled])]:shadow-[0_0_0_5px_var(--monti-bg-selected)] [&:hover_[data-slot=switch]:not([data-checked])]:bg-(--monti-border-strong)",
				spread && "justify-between",
				height === "md" && "min-h-monti-control-md",
				height === "sm" && "min-h-monti-control-sm",
				className,
			)}
			{...props}
		/>
	);
}

export { Option };
