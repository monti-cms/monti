"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Caret } from "./caret";
import { cn } from "./cn";
import { HIT_AREA } from "./hit-area";
import { TEXT_HOVER } from "./hover";

/**
 * A condition that is not on yet, in a filter row: its name and a caret, opening a list of values (tag ▾, language ▾, sort ▾). Once a value is
 * picked it becomes a `Chip`, or, with `dot`, stays where it is with a dot after its name. With `filled` it shows a value that is set, in ink (a setting's "after 30 days ▾"). Open a menu or popover from it with `render` on the trigger: `<DropdownMenuTrigger render={<FilterButton />}>`.
 */
function FilterButton({
	filled = false,
	dot = false,
	className,
	children,
	...props
}: ButtonPrimitive.Props & {
	/** It shows a value that is set ("after 30 days ▾"), in ink rather than the subtle gray of a condition not on yet. */
	filled?: boolean;
	/** A filter is on and its button stays: its name is in ink with a dot after it, as a list's column name has (the menu's ticks say which). */
	dot?: boolean;
}) {
	return (
		<ButtonPrimitive
			data-slot="filter-button"
			type="button"
			className={cn(
				TEXT_HOVER,
				HIT_AREA,
				"inline-flex cursor-pointer items-center rounded-monti-full border-0 bg-transparent p-0 outline-none not-disabled:hover:text-monti-default disabled:pointer-events-none disabled:opacity-45 aria-expanded:text-monti-default",
				filled || dot ? "text-monti-default" : "text-monti-subtle",
				className,
			)}
			{...props}
		>
			{children}
			{dot && (
				<span
					aria-hidden
					data-slot="filter-dot"
					className="ml-monti-4 size-[5px] shrink-0 rounded-monti-full bg-monti-emphasis"
				/>
			)}
			<Caret />
		</ButtonPrimitive>
	);
}

export { FilterButton };
