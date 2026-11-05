import type * as React from "react";
import { cn } from "./cn";
import { Grip } from "./grip";
import { HIT_AREA } from "./hit-area";

/**
 * The drag handle of a sortable row (a language, a navigation link, a choice of a select): six dots, faint until pointed at. Give it the sortable's `ref`
 * and listeners, and a name that says whose row it moves. The row decides where it sits and how large its box is.
 */
function DragHandle({ className, ...props }: Omit<React.ComponentProps<"button">, "children" | "type">) {
	return (
		<button
			type="button"
			data-slot="drag-handle"
			className={cn(
				HIT_AREA,
				"flex cursor-grab touch-none items-center justify-center rounded-monti-full border-0 bg-transparent p-0 text-monti-faint outline-none hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/20",
				className,
			)}
			{...props}
		>
			<Grip />
		</button>
	);
}

export { DragHandle };
