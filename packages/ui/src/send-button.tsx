"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "./cn";

/**
 * The round button that sends a message: black, with an arrow up. While the answer is being written (`busy`) it is a stop button, with a square.
 * `sm` is the 28px one of a note's reply row.
 */
function SendButton({
	label,
	busy = false,
	size = "md",
	className,
	...props
}: Omit<ButtonPrimitive.Props, "aria-label" | "children"> & {
	/** The name for screen readers ("Send", or "Stop" while busy). */
	label: string;
	busy?: boolean;
	size?: "md" | "sm";
}) {
	return (
		<ButtonPrimitive
			data-slot="send-button"
			type="button"
			aria-label={label}
			className={cn(
				"flex shrink-0 cursor-pointer items-center justify-center rounded-monti-full border-0 bg-monti-emphasis p-0 text-monti-on-emphasis outline-none transition-opacity hover:bg-monti-emphasis/90 focus-visible:ring-3 focus-visible:ring-monti-contrast/20 disabled:cursor-default disabled:opacity-35",
				size === "md" ? "size-8" : "size-7",
				className,
			)}
			{...props}
		>
			{busy ? (
				<Square aria-hidden className="size-3 fill-current" />
			) : (
				<ArrowUp aria-hidden className={size === "md" ? "size-4" : "size-3.5"} strokeWidth={1.8} />
			)}
		</ButtonPrimitive>
	);
}

export { SendButton };
