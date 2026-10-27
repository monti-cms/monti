import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";
import { cn } from "./cn";
import { CONTROL_SIZE, type ControlSize } from "./control";

/** Sizes of an inline input: the label size, or a heading's. */
const INLINE_SIZE = {
	sm: "text-monti-label",
	default: "text-monti-body",
	title: "text-monti-title",
	display: "text-monti-display",
} as const;

function Input({
	className,
	type,
	size = "default",
	mono = false,
	width = "full",
	appearance = "boxed",
	srOnly = false,
	align = "start",
	...props
}: Omit<React.ComponentProps<"input">, "size" | "width"> & {
	/** `sm` (32px) beside small buttons in toolbars, filters and tables; `default` (36px) in forms. */
	size?: ControlSize | "title" | "display";
	/** Fixed-width letters for slugs, paths, keys and code. */
	mono?: boolean;
	/** `number` for a short count or limit (96px), `short` for a word (the small panel width). */
	width?: "full" | "short" | "number";
	/**
	 * `inline` reads as text until focused, with no box (a name edited in place); its size can be a heading's: `title` (a tab or group
	 * name) or `display` (the post title).
	 */
	appearance?: "boxed" | "inline";
	/** Hidden but usable (a file input behind a button that opens it). */
	srOnly?: boolean;
	/** Where the text sits in the field (a caption that follows its image's alignment). */
	align?: "start" | "center" | "end";
}) {
	return (
		<InputPrimitive
			type={type}
			data-slot="input"
			data-size={size}
			className={cn(
				"w-full min-w-0 rounded-monti-md border border-monti-default bg-monti-page px-2.5 py-1 outline-none transition-[color,border-color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-monti-default file:text-monti-label placeholder:text-monti-subtle hover:border-monti-emphasis focus-visible:border-monti-contrast focus-visible:ring-3 focus-visible:ring-monti-contrast/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-monti-danger aria-invalid:ring-3 aria-invalid:ring-monti-danger/20",
				appearance === "inline" || size === "title" || size === "display"
					? "h-auto rounded-monti-sm border-transparent bg-transparent px-0 shadow-none hover:border-transparent focus-visible:border-transparent focus-visible:ring-2"
					: CONTROL_SIZE[size],
				(appearance === "inline" || size === "title" || size === "display") && INLINE_SIZE[size],
				width === "short" && "w-monti-menu",
				width === "number" && "w-24",
				mono && "font-mono",
				srOnly && "sr-only",
				align === "center" && "text-center",
				align === "end" && "text-right",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
