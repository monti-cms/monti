"use client";

import type { ComponentProps } from "react";
import { cn } from "./cn";

/** The floating row (`.mt-block-bar`, `.mt-format-bar`): 3px inside, 2px between buttons, an emphasis border, the floating shadow. */
export const BAR =
	"inline-flex items-center gap-monti-2 rounded-monti-lg border border-monti-emphasis bg-monti-page p-[3px] shadow-monti-floating";

/** A 28px button of a bar; the width is the bar's part to set. */
export const BAR_BUTTON =
	"inline-flex h-7 cursor-pointer items-center justify-center rounded-monti-md border-0 bg-transparent p-0 text-monti-muted outline-none transition-colors hover:bg-monti-selected hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/20 disabled:pointer-events-none disabled:opacity-45 aria-expanded:bg-monti-selected aria-expanded:text-monti-default aria-pressed:bg-monti-selected aria-pressed:text-monti-default data-[tone=danger]:text-monti-danger data-[tone=danger]:hover:bg-monti-danger-muted data-[tone=danger]:hover:text-monti-danger [&_svg:not([class*='size-'])]:size-4";

/** The line between two groups of buttons of a bar. */
export const BAR_SEPARATOR = "mx-[3px] h-4 shrink-0 border-monti-default border-l";

/**
 * A small row of tools that floats over the text: above selected words (the inline formats, then the assistant's request) or at the top left of a block
 * that has settings (an image: align, settings, crop). One row that does not wrap; the editor places it.
 */
function FloatingBar({ className, ...props }: ComponentProps<"div">) {
	return <div data-slot="floating-bar" role="toolbar" className={cn(BAR, "whitespace-nowrap", className)} {...props} />;
}

export { FloatingBar };
