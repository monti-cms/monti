"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { cn } from "./cn";
import type { ShortcutKeys } from "./shortcut";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/** The floating row (`.mt-block-bar`, `.mt-format-bar`): 3px inside, 2px between buttons, an emphasis border, the floating shadow. */
export const BAR =
	"inline-flex items-center gap-monti-2 rounded-monti-lg border border-monti-emphasis bg-monti-page p-[3px] shadow-monti-floating";

/** A 28px button of a bar; the width is the bar's part to set. */
export const BAR_BUTTON =
	"inline-flex h-monti-control-sm cursor-pointer items-center justify-center rounded-monti-md border-0 bg-transparent p-0 text-monti-muted outline-none transition-colors not-disabled:hover:bg-monti-selected not-disabled:hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/50 disabled:pointer-events-none disabled:opacity-45 aria-expanded:bg-monti-selected aria-expanded:text-monti-default aria-pressed:bg-monti-selected aria-pressed:text-monti-default data-[tone=danger]:text-monti-danger data-[tone=danger]:not-disabled:hover:bg-monti-danger-muted data-[tone=danger]:not-disabled:hover:text-monti-danger [&_svg:not([class*='size-'])]:size-4";

/**
 * A small row of tools that floats over the text: above selected words (the inline formats, then the assistant's request) or at the top left of a block
 * that has settings (an image: align, settings, crop). One row that does not wrap; the editor places it.
 */
function FloatingBar({ className, ...props }: ComponentProps<"div">) {
	return <div data-slot="floating-bar" role="toolbar" className={cn(BAR, "whitespace-nowrap", className)} {...props} />;
}

/**
 * A button of a floating bar (the format bar's formats, the block bar's tools): 28px high and at least as wide, its name in a tooltip (with its key combination when it has one). `pressed` keeps the
 * background while the format is on. It does not take the selection or the focus from the text on press. To make it the trigger of a menu or card, wrap it
 * with `trigger`: `trigger={(button) => <PopoverTrigger render={button} />}`.
 */
function FloatingBarButton({
	label,
	shortcut,
	pressed,
	tone,
	trigger,
	className,
	children,
	...props
}: Omit<ButtonPrimitive.Props, "aria-label" | "aria-pressed" | "children"> & {
	/** The name of the button: its screen reader name and its tooltip. */
	label: string;
	/** The key combination that does the same (`["mod", "B"]`), shown in the tooltip. */
	shortcut?: ShortcutKeys;
	pressed?: boolean;
	/** `danger` for a button that removes something. */
	tone?: "danger";
	trigger?: (button: ReactElement) => ReactElement;
	children: ReactNode;
}) {
	const button = (
		<ButtonPrimitive
			data-slot="floating-bar-button"
			type="button"
			aria-label={label}
			aria-pressed={pressed}
			data-tone={tone}
			// Do not take the selection or the focus from the text on press.
			onMouseDown={(event) => event.preventDefault()}
			className={cn(BAR_BUTTON, "min-w-7 px-monti-4 text-monti-body", className)}
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

export { FloatingBar, FloatingBarButton };
