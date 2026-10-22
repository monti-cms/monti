"use client";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cn } from "./cn";

function Separator({
	className,
	orientation = "horizontal",
	length = "full",
	...props
}: SeparatorPrimitive.Props & {
	/** A vertical separator's height: `full` stretches to the row, `control` is half a control's height, centered (in a toolbar). */
	length?: "full" | "control";
}) {
	return (
		<SeparatorPrimitive
			data-slot="separator"
			orientation={orientation}
			className={cn(
				"monti-horizontal:h-px monti-horizontal:w-full monti-vertical:w-px shrink-0 bg-monti-divider",
				length === "full"
					? "monti-vertical:self-stretch"
					: "monti-vertical:mx-tight monti-vertical:h-4 monti-vertical:self-center",
				className,
			)}
			{...props}
		/>
	);
}

export { Separator };
