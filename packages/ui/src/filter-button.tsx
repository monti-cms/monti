"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Caret } from "./caret";
import { cn } from "./cn";

/**
 * A condition that is not on yet, in a filter row: its name and a caret, opening a list of values (tag ▾, language ▾, sort ▾). Once a value is
 * picked it becomes a `Chip`. With `filled` it shows a value that is set, in ink (a setting's "30일 뒤 ▾"). Open a menu or popover from it with `render` on the trigger: `<DropdownMenuTrigger render={<FilterButton />}>`.
 */
function FilterButton({
	filled = false,
	className,
	children,
	...props
}: ButtonPrimitive.Props & {
	/** It shows a value that is set ("30일 뒤 ▾"), in ink rather than the subtle gray of a condition not on yet. */
	filled?: boolean;
}) {
	return (
		<ButtonPrimitive
			data-slot="filter-button"
			type="button"
			className={cn(
				"inline-flex cursor-pointer items-center border-0 bg-transparent p-0 outline-none hover:text-monti-default focus-visible:rounded-monti-sm focus-visible:ring-2 focus-visible:ring-monti-contrast/20 disabled:cursor-default disabled:opacity-45 aria-expanded:text-monti-default",
				filled ? "text-monti-default" : "text-monti-subtle",
				className,
			)}
			{...props}
		>
			{children}
			<Caret />
		</ButtonPrimitive>
	);
}

export { FilterButton };
