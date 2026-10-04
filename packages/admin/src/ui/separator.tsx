"use client";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cn } from "../lib/utils";

function Separator({ className, orientation = "horizontal", ...props }: SeparatorPrimitive.Props) {
	return (
		<SeparatorPrimitive
			data-slot="separator"
			orientation={orientation}
			className={cn(
				"cms-horizontal:h-px cms-horizontal:w-full cms-vertical:w-px shrink-0 cms-vertical:self-stretch bg-cms-border",
				className,
			)}
			{...props}
		/>
	);
}

export { Separator };
