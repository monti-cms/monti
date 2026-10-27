"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Caret } from "./caret";
import { cn } from "./cn";

/**
 * A condition that is not on yet, in a filter row: its name and a caret, opening a list of values (tag ▾, language ▾, sort ▾). Once a value is
 * picked it becomes a `Chip`. Open a menu or popover from it with `render` on the trigger: `<DropdownMenuTrigger render={<FilterButton />}>`.
 */
function FilterButton({ className, children, ...props }: ButtonPrimitive.Props) {
	return (
		<ButtonPrimitive
			data-slot="filter-button"
			type="button"
			className={cn(
				"inline-flex cursor-pointer items-center border-0 bg-transparent p-0 text-monti-subtle outline-none hover:text-monti-default focus-visible:rounded-monti-sm focus-visible:ring-2 focus-visible:ring-monti-contrast/20 disabled:cursor-default disabled:opacity-45 aria-expanded:text-monti-default",
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
