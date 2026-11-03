"use client";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cn } from "./cn";

function Separator({
	className,
	orientation = "horizontal",
	length = "full",
	flush = false,
	...props
}: SeparatorPrimitive.Props & {
	/**
	 * A vertical separator's height: `full` stretches to the row, `control` is the design system's 14px rule, centered (in a toolbar), and `bar` the 16px
	 * rule between two groups of a floating bar, 3px from each.
	 */
	length?: "full" | "control" | "bar";
	/** No room of its own at its sides: the row's gap spaces it (a page toolbar, a bulk bar). */
	flush?: boolean;
}) {
	return (
		<SeparatorPrimitive
			data-slot="separator"
			orientation={orientation}
			className={cn(
				"monti-horizontal:h-px monti-horizontal:w-full monti-vertical:w-px shrink-0",
				// A line between rows is the quiet row line; the rule between two controls is the design system's `border-default`, 1 by 14.
				length === "full"
					? "monti-vertical:self-stretch bg-monti-divider"
					: length === "bar"
						? "monti-vertical:mx-[3px] monti-vertical:h-4 monti-vertical:self-center bg-(--monti-border-default)"
						: "monti-vertical:mx-monti-4 monti-vertical:h-3.5 monti-vertical:self-center bg-(--monti-border-default)",
				flush && "monti-vertical:mx-0",
				className,
			)}
			{...props}
		/>
	);
}

export { Separator };
