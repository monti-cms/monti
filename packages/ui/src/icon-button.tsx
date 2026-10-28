"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { ReactElement, ReactNode } from "react";
import { cn } from "./cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/** The look of a round icon button, for parts that render their own button (a combobox's open and clear buttons). */
export const ICON_BUTTON =
	"inline-flex size-monti-icon-button shrink-0 items-center justify-center rounded-monti-full border-0 bg-transparent p-0 text-monti-muted outline-none transition-colors hover:bg-monti-selected hover:text-monti-default focus-visible:ring-3 focus-visible:ring-monti-contrast/20 disabled:pointer-events-none disabled:opacity-45 aria-expanded:bg-monti-selected aria-expanded:text-monti-default aria-pressed:bg-monti-selected aria-pressed:text-monti-default data-[tone=danger]:text-monti-danger data-[tone=danger]:hover:bg-monti-danger-muted data-[tone=danger]:hover:text-monti-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

/**
 * A round icon button, 32px: the header's more (⋯), properties and assistant, a panel's close. `label` is both the screen reader name and the
 * tooltip shown on hover (the two are always the same). With `pressed` it is a toggle and keeps a background while on. `tone="danger"` is for
 * a button that deletes or removes something: the icon is red and its hover background the red wash.
 * For a button that opens a menu or popover, wrap it with `trigger`: `trigger={(button) => <PopoverTrigger render={button} />}`.
 */
export function IconButton({
	label,
	pressed,
	tone,
	side = "top",
	className,
	trigger,
	children,
	type = "button",
	...props
}: Omit<ButtonPrimitive.Props, "aria-label" | "aria-pressed" | "children"> & {
	label: string;
	pressed?: boolean;
	/** `danger` for a button that deletes or removes something. */
	tone?: "danger";
	side?: "top" | "bottom" | "left" | "right";
	trigger?: (button: ReactElement) => ReactElement;
	children: ReactNode;
}) {
	const button = (
		<ButtonPrimitive
			data-slot="icon-button"
			type={type}
			aria-label={label}
			aria-pressed={pressed}
			data-tone={tone}
			className={cn(ICON_BUTTON, className)}
			{...props}
		/>
	);
	return (
		<Tooltip>
			<TooltipTrigger render={trigger ? trigger(button) : button}>{children}</TooltipTrigger>
			<TooltipContent side={side}>{label}</TooltipContent>
		</Tooltip>
	);
}
