import type * as React from "react";
import { cn } from "./cn";
import { MENU_LABEL, MENU_ROW, MENU_SEPARATOR } from "./menu-parts";

/**
 * A short list of kinds to pick one from, drawn as menu rows without the floating card (the kind of a new field: text, choice, media, link).
 * It stays on the page and the picked row stays marked. Name it with `aria-label`. Rows are {@link PickListItem}s, the options of a listbox.
 */
function PickList({ className, ...props }: Omit<React.ComponentProps<"div">, "role">) {
	return <div role="listbox" data-slot="pick-list" className={cn("flex flex-col gap-monti-4", className)} {...props} />;
}

/**
 * One kind in a {@link PickList}: its name, and `mark` at the end for a real add-on to the name (the plugin a kind comes from: "Ollama", "seo"). It never
 * carries an arrow: the row's place in the list already says that picking it shows more beside it. The picked row takes the selected background and the
 * ink color; the others are muted. A row is 32px, like every menu row.
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
				MENU_ROW,
				// On the sheet's ground, not in a floating menu: a one-line row there is a pill.
				"w-full cursor-pointer rounded-monti-full border-0 bg-transparent px-[14px] text-left not-disabled:hover:bg-monti-selected not-disabled:hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/50 disabled:pointer-events-none disabled:opacity-45 aria-selected:bg-monti-current aria-selected:text-monti-default",
				className,
			)}
			{...props}
		>
			{children}
			{mark && <span className="ml-auto shrink-0 font-mono text-monti-micro text-monti-subtle">{mark}</span>}
		</button>
	);
}

/** The name of a group of rows in a {@link PickList} ("AI", "Plugins"): mono, small, like a menu's. */
function PickListLabel({ className, ...props }: Omit<React.ComponentProps<"span">, "role">) {
	return <span role="presentation" data-slot="pick-list-label" className={cn(MENU_LABEL, className)} {...props} />;
}

/** The rule between two groups of a {@link PickList}, with more room than a menu's since the dialog rows are taller. */
function PickListSeparator({
	className,
	...props
}: Omit<React.ComponentProps<"span">, "role" | "children" | "aria-hidden">) {
	return (
		<span
			aria-hidden="true"
			data-slot="pick-list-separator"
			className={cn(MENU_SEPARATOR, "my-monti-10", className)}
			{...props}
		/>
	);
}

export { PickList, PickListItem, PickListLabel, PickListSeparator };
