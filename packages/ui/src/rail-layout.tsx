import type * as React from "react";
import { cn } from "./cn";

/**
 * A page part with a list of links beside it, as the collections sit beside their editor in Settings: the links are a `nav` named by `label` (160px at
 * least, 20px down from the toolbar) and the content takes the rest. Narrow, the content wraps under the links.
 */
function RailLayout({
	label,
	rail,
	className,
	children,
	...props
}: Omit<React.ComponentProps<"div">, "children"> & {
	/** The name of the navigation for a screen reader. */
	label: string;
	/** The links, and whatever goes under them ("+ New collection"). */
	rail: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div data-slot="rail-layout" className={cn("flex flex-wrap gap-x-monti-40", className)} {...props}>
			<nav aria-label={label} className="flex flex-[1_1_160px] flex-col gap-monti-2 pt-monti-20">
				{rail}
			</nav>
			<div className="min-w-0 flex-[999_1_480px]">{children}</div>
		</div>
	);
}

export { RailLayout };
