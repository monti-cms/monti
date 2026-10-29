"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { cn } from "./cn";
import type { ShortcutKeys } from "./shortcut";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/** The floating row both bars share (`.mt-block-bar`, `.mt-format-bar`): 3px inside, 2px between buttons, an emphasis border, the floating shadow. */
export const BAR =
	"inline-flex items-center gap-monti-2 rounded-monti-lg border border-monti-emphasis bg-monti-page p-[3px] shadow-monti-floating";

/** A 28px button of a bar; the width is the bar's part to set. */
export const BAR_BUTTON =
	"inline-flex h-7 cursor-pointer items-center justify-center rounded-monti-md border-0 bg-transparent p-0 text-monti-muted outline-none transition-colors hover:bg-monti-selected hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/20 disabled:pointer-events-none disabled:opacity-45 aria-expanded:bg-monti-selected aria-expanded:text-monti-default aria-pressed:bg-monti-selected aria-pressed:text-monti-default data-[tone=danger]:text-monti-danger data-[tone=danger]:hover:bg-monti-danger-muted data-[tone=danger]:hover:text-monti-danger [&_svg:not([class*='size-'])]:size-4";

/** The line between two groups of buttons of a bar. */
export const BAR_SEPARATOR = "mx-[3px] h-4 shrink-0 border-monti-default border-l";

/**
 * The small row of tools above a block that has settings (an image: align, settings, crop). Put `BlockBarButton`s in it and a `BlockBarSeparator`
 * between groups. It is a floating card; the editor places it at the block's top left.
 */
function BlockBar({ className, ...props }: ComponentProps<"div">) {
	return <div data-slot="block-bar" role="toolbar" className={cn(BAR, className)} {...props} />;
}

/** A tool of the bar: a 28px icon button. `label` is its name and its tooltip, and `shortcut` its key combination; `pressed` keeps the background while the tool is on. */
function BlockBarButton({
	label,
	shortcut,
	pressed,
	trigger,
	children,
	...props
}: Omit<ButtonPrimitive.Props, "aria-label" | "aria-pressed" | "children"> & {
	label: string;
	shortcut?: ShortcutKeys;
	pressed?: boolean;
	/** Wraps the button to make it the trigger of a card or menu: `trigger={(button) => <PopoverTrigger render={button} />}`. */
	trigger?: (button: ReactElement) => ReactElement;
	children: ReactNode;
}) {
	const button = (
		<ButtonPrimitive
			data-slot="block-bar-button"
			type="button"
			aria-label={label}
			aria-pressed={pressed}
			className={cn(BAR_BUTTON, "w-7")}
			{...props}
		/>
	);
	return (
		<Tooltip>
			<TooltipTrigger render={trigger ? trigger(button) : button}>{children}</TooltipTrigger>
			<TooltipContent side="top" shortcut={shortcut}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}

/** The line between two groups of tools. */
function BlockBarSeparator() {
	return <span data-slot="block-bar-separator" aria-hidden className={BAR_SEPARATOR} />;
}

/**
 * A square handle on a bottom corner of a selected block (an image); dragging it changes the block's width. The parent is `relative`; the handle
 * sits half outside its corner. The editor reads the drag from the pointer events.
 */
function ResizeCorner({
	side,
	label,
	className,
	...props
}: Omit<ComponentProps<"button">, "aria-label" | "children"> & {
	side: "left" | "right";
	label: string;
}) {
	return (
		<button
			data-slot="resize-corner"
			type="button"
			aria-label={label}
			className={cn(
				"absolute -bottom-[5px] size-[11px] rounded-monti-sm border border-monti-strong bg-monti-page p-0 outline-none focus-visible:ring-2 focus-visible:ring-monti-contrast/20",
				side === "left" ? "-left-[5px] cursor-nesw-resize" : "-right-[5px] cursor-nwse-resize",
				className,
			)}
			{...props}
		/>
	);
}

export { BlockBar, BlockBarButton, BlockBarSeparator, ResizeCorner };
