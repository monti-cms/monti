"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";
import { cn } from "./cn";
import { useProposalDescription } from "./proposal-cue";

/** The text of an input that reads as text (no underline): the label size, or a heading's. */
const INLINE_SIZE = {
	sm: "text-monti-note",
	default: "text-monti-body",
	title: "text-monti-title",
	display: "text-monti-display",
} as const;

/**
 * A one-line field drawn as an underline, never a box. The underline turns ink on focus and danger when `aria-invalid`; the placeholder is
 * faint. `proposal` marks a value the assistant wrote and nobody has touched: blue text and a 1.5px blue underline.
 */
function Input({
	className,
	type,
	size = "default",
	mono = false,
	width = "full",
	appearance = "line",
	proposal = false,
	srOnly = false,
	align = "start",
	...props
}: Omit<React.ComponentProps<"input">, "size" | "width"> & {
	/** `sm` (28px) beside small buttons in toolbars, filters and tables; `default` in forms. */
	size?: keyof typeof INLINE_SIZE;
	/** Fixed-width letters for slugs, paths, keys and code. */
	mono?: boolean;
	/** `number` for a short count or limit (96px), `short` for a word (the small panel width). */
	width?: "full" | "short" | "number";
	/**
	 * `inline` reads as text until focused, with no line at all (a name edited in place); its size can be a heading's: `title` (a tab or
	 * group name) or `display` (the post title).
	 */
	appearance?: "line" | "inline";
	/** The assistant wrote this value and nobody has touched it yet. Turn it off when the value is edited. */
	proposal?: boolean;
	/** Hidden but usable (a file input behind a button that opens it). */
	srOnly?: boolean;
	/** Where the text sits in the field (a caption that follows its image's alignment). */
	align?: "start" | "center" | "end";
}) {
	const inline = appearance === "inline" || size === "title" || size === "display";
	return (
		<InputPrimitive
			type={type}
			data-slot="input"
			data-size={size}
			data-proposal={proposal || undefined}
			aria-description={useProposalDescription(proposal)}
			className={cn(
				"w-full min-w-0 rounded-none bg-transparent outline-none transition-colors placeholder:text-monti-faint disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
				inline
					? "h-auto rounded-monti-sm border-0 px-0 focus-visible:ring-2 focus-visible:ring-monti-contrast/20"
					: "border-0 border-monti-default border-b text-monti-default text-monti-reading focus-visible:border-monti-contrast aria-invalid:border-monti-danger data-proposal:border-monti-proposal data-proposal:border-b-[1.5px] data-proposal:text-monti-proposal md:text-monti-body",
				inline ? INLINE_SIZE[size] : size === "sm" ? "py-monti-4 md:text-monti-note" : "py-monti-6",
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
