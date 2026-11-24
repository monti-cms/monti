import type * as React from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { NAV_ROW } from "./nav-link";

/**
 * A page part with a list of links beside it, as the collections sit beside their editor in Settings: the links are a `nav` named by `label` (160px at
 * least, 20px down from the toolbar) and the content takes the rest. Narrow, the content wraps under the links.
 */
function RailLayout({
	label,
	rail,
	layout = "flow",
	className,
	children,
	...props
}: Omit<React.ComponentProps<"div">, "children"> & {
	/** The name of the navigation for a screen reader. */
	label: string;
	/** The links, and whatever goes under them ("+ New collection"). */
	rail: React.ReactNode;
	/**
	 * `flow` (the default): as above. `grid`: the settings collections of the 2026-11 redesign (`settings-basics.html`): a 200px rail, 40px, the content,
	 * both 20px under the tabs; the links 0px apart.
	 */
	layout?: "flow" | "grid";
	children: React.ReactNode;
}) {
	if (layout === "grid")
		return (
			<div
				data-slot="rail-layout"
				data-layout="grid"
				className={cn("grid grid-cols-[200px_minmax(0,1fr)] gap-x-monti-40 pt-monti-20", className)}
				{...props}
			>
				<nav aria-label={label} className="flex min-w-0 flex-col">
					{rail}
				</nav>
				<div className="min-w-0">{children}</div>
			</div>
		);
	return (
		<div data-slot="rail-layout" className={cn("flex flex-wrap gap-x-monti-40", className)} {...props}>
			<nav aria-label={label} className="flex flex-[1_1_160px] flex-col gap-monti-4 pt-monti-20">
				{rail}
			</nav>
			<div className="min-w-0 flex-[999_1_480px]">{children}</div>
		</div>
	);
}

/**
 * The quiet button under the links ("+ New collection"), its text in line with theirs. `row` (a `grid` rail): a link's row itself, under a
 * `border-muted` rule 8px below the links, its + on the links' icons and its words subtle.
 */
function RailAction({
	row = false,
	className,
	...props
}: Omit<React.ComponentProps<typeof Button>, "variant" | "size"> & { row?: boolean }) {
	if (row)
		return (
			<div data-slot="rail-action" className="mt-monti-8 border-monti-muted border-t pt-monti-8">
				<button
					type="button"
					className={cn(NAV_ROW, "cursor-pointer text-monti-subtle [&_svg]:size-4", className)}
					// The row is a plain button: Base UI's state-function props do not apply to it.
					{...(props as React.ComponentProps<"button">)}
				/>
			</div>
		);
	return (
		<div data-slot="rail-action" className="pt-monti-12">
			<Button variant="ghost" size="sm" className={className} {...props} />
		</div>
	);
}

export { RailAction, RailLayout };
