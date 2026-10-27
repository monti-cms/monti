"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { cn } from "./cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/**
 * The small row of tools above a block that has settings (an image: align, settings, crop). Put `BlockBarButton`s in it and a `BlockBarSeparator`
 * between groups. It is a floating card; the editor places it at the block's top left.
 */
function BlockBar({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="block-bar"
			role="toolbar"
			className={cn(
				"inline-flex items-center gap-monti-2 rounded-monti-lg border border-monti-emphasis bg-monti-page p-[3px] shadow-monti-floating",
				className,
			)}
			{...props}
		/>
	);
}

/** A tool of the bar: a 28px icon button. `label` is its name and its tooltip; `pressed` keeps the background while the tool is on. */
function BlockBarButton({
	label,
	pressed,
	trigger,
	children,
	...props
}: Omit<ButtonPrimitive.Props, "aria-label" | "aria-pressed" | "children"> & {
	label: string;
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
			className="inline-flex size-7 cursor-pointer items-center justify-center rounded-monti-md border-0 bg-transparent p-0 text-monti-muted outline-none transition-colors hover:bg-monti-selected hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/20 aria-expanded:bg-monti-selected aria-expanded:text-monti-default aria-pressed:bg-monti-selected aria-pressed:text-monti-default [&_svg:not([class*='size-'])]:size-4"
			{...props}
		/>
	);
	return (
		<Tooltip>
			<TooltipTrigger render={trigger ? trigger(button) : button}>{children}</TooltipTrigger>
			<TooltipContent side="top">{label}</TooltipContent>
		</Tooltip>
	);
}

/** The line between two groups of tools. */
function BlockBarSeparator() {
	return <span data-slot="block-bar-separator" aria-hidden className="mx-[3px] h-4 border-monti-default border-l" />;
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
