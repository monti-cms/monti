"use client";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cn } from "../lib/utils";

function Separator({ className, orientation = "horizontal", ...props }: SeparatorPrimitive.Props) {
	return (
		<SeparatorPrimitive
			data-slot="separator"
			orientation={orientation}
			className={cn(
				"monti-horizontal:h-px monti-horizontal:w-full monti-vertical:w-px shrink-0 monti-vertical:self-stretch bg-monti-border",
				className,
			)}
			{...props}
		/>
	);
}

export { Separator };
