import type * as React from "react";
import { cn } from "./cn";

/**
 * Several buttons of the same kind joined into one control (a row of related actions). The inner edges lose their radius and a 1px gap
 * (the page showing through) separates them; give every button the same variant and size. A main action with a menu of its variants
 * ("Publish" + "Republish with today's date") is not a group: use `SplitButton`.
 */
function ButtonGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			role="group"
			data-slot="button-group"
			className={cn(
				"flex items-stretch gap-px [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none",
				className,
			)}
			{...props}
		/>
	);
}

export { ButtonGroup };
