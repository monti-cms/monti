"use client";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cn } from "./cn";

function Separator({
	className,
	orientation = "horizontal",
	length = "full",
	...props
}: SeparatorPrimitive.Props & {
	/** A vertical separator's height: `full` stretches to the row, `control` is the design system's 14px rule, centered (in a toolbar). */
	length?: "full" | "control";
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
					: "monti-vertical:mx-monti-4 monti-vertical:h-3.5 monti-vertical:self-center bg-(--monti-border-default)",
				className,
			)}
			{...props}
		/>
	);
}

export { Separator };
