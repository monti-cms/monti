import type * as React from "react";
import { cn } from "./cn";

/**
 * A short list of kinds to pick one from, drawn as menu rows without the floating card (the kind of a new field: text, choice, media, link).
 * It stays on the page and the picked row stays marked. Name it with `aria-label`. Rows are {@link PickListItem}s, the options of a listbox.
 */
function PickList({ className, ...props }: Omit<React.ComponentProps<"div">, "role">) {
	return <div role="listbox" data-slot="pick-list" className={cn("flex flex-col", className)} {...props} />;
}

/**
 * One kind in a {@link PickList}: its name, and `mark` at the end when picking it opens more (→). The picked row takes the selected background and
 * the ink color; the others are muted.
 */
function PickListItem({
	selected = false,
	mark,
	className,
	children,
	...props
}: Omit<React.ComponentProps<"button">, "type" | "role" | "aria-selected"> & {
	selected?: boolean;
	mark?: React.ReactNode;
}) {
	return (
		<button
			type="button"
			role="option"
			aria-selected={selected}
			data-slot="pick-list-item"
			className={cn(
				"flex w-full min-w-0 cursor-pointer items-center gap-[10px] rounded-monti-md border-0 bg-transparent px-[9px] py-[7px] text-left text-monti-body text-monti-muted outline-none hover:bg-monti-selected hover:text-monti-default focus-visible:ring-3 focus-visible:ring-monti-contrast/20 disabled:pointer-events-none disabled:opacity-45 aria-selected:bg-monti-selected aria-selected:text-monti-default",
				className,
			)}
			{...props}
		>
			{children}
			{mark && <span className="ml-auto shrink-0 font-mono text-monti-micro text-monti-subtle">{mark}</span>}
		</button>
	);
}

export { PickList, PickListItem };
