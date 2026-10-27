"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "./cn";

function TooltipProvider({ delay = 0, ...props }: TooltipPrimitive.Provider.Props) {
	return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />;
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
	return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
	return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

/**
 * The name of an icon button, a small black pill: 12px, one line, with its key combination after it in mono when it has one. Only names go in it (one or two
 * words), never a sentence; a text button needs no tooltip.
 */
function TooltipContent({
	className,
	side = "top",
	sideOffset = 6,
	align = "center",
	alignOffset = 0,
	shortcut,
	children,
	...props
}: TooltipPrimitive.Popup.Props &
	Pick<TooltipPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset"> & {
		/** The key combination that does the same ("⌘S"). */
		shortcut?: string;
	}) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Positioner
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
				className="isolate z-50"
			>
				<TooltipPrimitive.Popup
					data-slot="tooltip-content"
					className={cn(
						"data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 z-50 inline-flex w-fit origin-(--transform-origin) items-center gap-monti-6 whitespace-nowrap rounded-monti-md bg-monti-emphasis px-monti-8 py-monti-4 text-monti-caption text-monti-on-emphasis shadow-monti-floating data-closed:animate-out data-open:animate-in",
						className,
					)}
					{...props}
				>
					{children}
					{shortcut && <span className="text-monti-micro opacity-70">{shortcut}</span>}
				</TooltipPrimitive.Popup>
			</TooltipPrimitive.Positioner>
		</TooltipPrimitive.Portal>
	);
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
