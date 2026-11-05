import * as React from "react";
import { cn } from "./cn";

/**
 * What a group of choice rows tells its rows: their height and how their words read. A `RadioGroup` gives its height; a change in the review
 * (`ChangeGroup`) gives `quiet` words. A row's own prop wins over the group's.
 */
const OptionContext = React.createContext<{ height?: "md" | "sm"; text?: "body" | "quiet" }>({});

/**
 * A row of a choice: a control (checkbox, radio, switch), its text and, if needed, a note. Pressing the text presses the control.
 * `spread` pushes the control to the far end of the row, the way a switch row reads ("Put the language in the preview path ⬤").
 * The row stands at a control's height, `md` (32px) unless told otherwise, so rows holding a switch, a checkbox, an input or a select stand at one even
 * spacing; a group of rows puts 4px between them.
 */
function Option({
	spread = false,
	height,
	text,
	className,
	...props
}: React.ComponentProps<"label"> & {
	/** The control sits at the far end, the text at the start. */
	spread?: boolean;
	/** The row's height: that of a control of this size (`md` 32px, the default; `sm` 28px). */
	height?: "md" | "sm";
	/** `body` (14px, ink; the default) or `quiet` (13px, muted until picked: the choices of a change in the review). */
	text?: "body" | "quiet";
}) {
	const group = React.useContext(OptionContext);
	const rowHeight = height ?? group.height ?? "md";
	const words = text ?? group.text ?? "body";
	return (
		<label
			data-slot="option"
			data-height={rowHeight}
			className={cn(
				"[&:hover_[data-slot=checkbox]:not([data-disabled]):not([data-checked])]:border-(color:--monti-fg-muted) flex cursor-pointer items-center gap-monti-10 has-data-disabled:cursor-not-allowed has-disabled:cursor-not-allowed has-data-disabled:opacity-45 [&:hover_[data-slot=checkbox]:not([data-disabled])]:shadow-[0_0_0_5px_var(--monti-bg-selected)] [&:hover_[data-slot=switch]:not([data-checked])]:bg-(--monti-border-strong)",
				words === "quiet" ? "text-monti-muted text-monti-note has-data-checked:text-monti-default" : "text-monti-body",
				spread && "justify-between",
				rowHeight === "md" ? "min-h-monti-control-md" : "min-h-monti-control-sm",
				className,
			)}
			{...props}
		/>
	);
}

export { Option, OptionContext };
