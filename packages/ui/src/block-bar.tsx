"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { cn } from "./cn";
import { BAR_BUTTON, BAR_SEPARATOR } from "./floating-bar";
import type { ShortcutKeys } from "./shortcut";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

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

export { BlockBarButton, BlockBarSeparator, ResizeCorner };
