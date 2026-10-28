import type * as React from "react";
import { cn } from "./cn";

/**
 * A row of a choice: a control (checkbox, radio, switch), its text and, if needed, a note. Pressing the text presses the control.
 * `spread` pushes the control to the far end of the row, the way a switch row reads ("Put the language in the preview path ⬤").
 */
function Option({
	spread = false,
	className,
	...props
}: React.ComponentProps<"label"> & {
	/** The control sits at the far end, the text at the start. */
	spread?: boolean;
}) {
	return (
		<label
			data-slot="option"
			className={cn(
				"flex cursor-pointer items-center gap-monti-10 text-monti-body has-data-disabled:cursor-not-allowed has-disabled:cursor-not-allowed has-data-disabled:opacity-45",
				spread && "justify-between",
				className,
			)}
			{...props}
		/>
	);
}

export { Option };
