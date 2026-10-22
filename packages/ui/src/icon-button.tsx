"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/**
 * An icon-only button. `label` is both the screen reader name and the tooltip shown on hover (the two are always the same).
 * With `pressed` it becomes a toggle button and has a background while on. Grey by default (`quiet`); `tone="danger"` for a remove button.
 * For a button that opens a menu or popover, wrap it with `trigger`: `trigger={(button) => <PopoverTrigger render={button} />}`.
 */
export function IconButton({
	label,
	pressed,
	side = "top",
	size = "icon-sm",
	variant = "quiet",
	className,
	trigger,
	children,
	...props
}: Omit<ComponentProps<typeof Button>, "aria-label" | "aria-pressed" | "children"> & {
	label: string;
	pressed?: boolean;
	side?: "top" | "bottom" | "left" | "right";
	trigger?: (button: ReactElement) => ReactElement;
	children: ReactNode;
}) {
	const button = (
		<Button
			type="button"
			variant={variant}
			size={size}
			aria-label={label}
			aria-pressed={pressed}
			className={cn("aria-pressed:bg-monti-selected aria-pressed:text-monti-default", className)}
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
