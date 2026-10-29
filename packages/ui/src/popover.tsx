"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type * as React from "react";
import { cn } from "./cn";
import { MENU_CARD, MENU_MOTION } from "./menu-parts";

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
	return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
	return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

const POPOVER_WIDTH = {
	sm: "w-monti-menu",
	md: "w-monti-panel",
	lg: "w-monti-assistant",
	dialog: "w-[420px] max-w-(--available-width)",
	auto: "w-auto",
	anchor: "w-(--anchor-width) min-w-monti-menu",
} as const;

function PopoverContent({
	className,
	align = "center",
	alignOffset = 0,
	side = "bottom",
	sideOffset = 4,
	anchor,
	width = "md",
	padding = "default",
	scroll = false,
	...props
}: PopoverPrimitive.Popup.Props &
	Pick<PopoverPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset" | "anchor"> & {
		/** `sm` 240px (the width of a menu), `md` 300px (default, a panel), `lg` 380px (the assistant), `dialog` 420px (as wide as a dialog: one field over a block, such as an image's alt text), `auto` as wide as its content, `anchor` as wide as what opened it. */
		width?: keyof typeof POPOVER_WIDTH;
		/** `menu` for a list of rows (6px, as a menu card); `default` for a small form or a note (12px above, 16 at the sides and below); `none` when the content brings its own rows (a calendar) and runs to the edge. */
		padding?: "default" | "menu" | "none";
		/** Scrolls inside when taller than the space left on screen. */
		scroll?: boolean;
	}) {
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Positioner
				anchor={anchor}
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
				className="isolate z-50"
			>
				<PopoverPrimitive.Popup
					data-slot="popover-content"
					className={cn(
						MENU_CARD,
						MENU_MOTION,
						"z-50 gap-monti-12",
						POPOVER_WIDTH[width],
						padding === "default" && "px-monti-16 pt-monti-12 pb-monti-16",
						padding === "menu" && "gap-0 p-monti-6",
						scroll && "max-h-(--available-height) overflow-y-auto",
						className,
					)}
					{...props}
				/>
			</PopoverPrimitive.Positioner>
		</PopoverPrimitive.Portal>
	);
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div data-slot="popover-header" className={cn("flex flex-col gap-monti-4 text-monti-body", className)} {...props} />
	);
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
	return <PopoverPrimitive.Title data-slot="popover-title" className={cn("font-semibold", className)} {...props} />;
}

function PopoverDescription({ className, ...props }: PopoverPrimitive.Description.Props) {
	return (
		<PopoverPrimitive.Description
			data-slot="popover-description"
			className={cn("text-monti-muted", className)}
			{...props}
		/>
	);
}

export { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger };
