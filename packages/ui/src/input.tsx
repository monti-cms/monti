"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";
import { cn } from "./cn";
import { FIELD_ACTION, FIELD_ACTION_SIZE, FIELD_HOVER, FIELD_INSET } from "./hover";
import { useProposalDescription } from "./proposal-cue";

/** The text of an input that reads as text (no underline): the label size, or a heading's. */
const INLINE_SIZE = {
	sm: "text-monti-note",
	md: "text-monti-body",
	default: "text-monti-body",
	title: "text-monti-title",
	display: "text-monti-display",
	/** The type of the text it stands in: a block's own title or tab name, edited where it reads. */
	inherit: "text-[length:inherit] font-[inherit] text-inherit placeholder:text-current placeholder:opacity-50",
} as const;

/**
 * A one-line field drawn as an underline, never a box. The underline turns ink on focus and danger when `aria-invalid`; the placeholder is
 * faint. `proposal` marks a value the assistant wrote and nobody has touched: blue text and a 1.5px blue underline. `action` is a control at the
 * end of the line (a button that makes the value again from the body); the underline then runs under it too, like a select's caret.
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
	action,
	...props
}: Omit<React.ComponentProps<"input">, "size" | "width"> & {
	/** `sm` (28px) beside small buttons in toolbars, filters and tables; `default` in forms. */
	size?: keyof typeof INLINE_SIZE;
	/** Fixed-width letters for slugs, paths, keys and code. */
	mono?: boolean;
	/**
	 * `number` for a short count or limit (96px), `short` for a word (the small panel width), `fit` as wide as what it holds (a tab's name), `choice` a
	 * short value at the end of a choice row (96px, at the note size on the row's own 20px line with 1px under it, so the row keeps the height of a switch
	 * row; like a select's `choice`).
	 */
	width?: "full" | "short" | "number" | "fit" | "choice";
	/**
	 * `inline` reads as text until focused, with no line at all (a name edited in place); its size can be a heading's: `title` (a tab or
	 * group name) or `display` (the post title), or `inherit`, the type of the text it stands in (a block's title). A heading-size field shows only its caret when focused, never a box around it; a smaller inline
	 * field gets a faint ring.
	 */
	appearance?: "line" | "inline";
	/** The assistant wrote this value and nobody has touched it yet. Turn it off when the value is edited. */
	proposal?: boolean;
	/** Hidden but usable (a file input behind a button that opens it). */
	srOnly?: boolean;
	/** Where the text sits in the field (a caption that follows its image's alignment). */
	align?: "start" | "center" | "end";
	/** A control at the end of the line, for a line field. */
	action?: React.ReactNode;
}) {
	const inline = appearance === "inline" || size === "title" || size === "display" || size === "inherit";
	const fieldHeight =
		size === "sm" ? "h-monti-control-sm" : size === "md" ? "h-monti-control-md" : "h-monti-control-lg";
	const input = (
		<InputPrimitive
			type={type}
			data-slot="input"
			data-size={size}
			data-proposal={proposal || undefined}
			aria-description={useProposalDescription(proposal)}
			className={cn(
				"w-full min-w-0 rounded-none bg-transparent outline-none transition-colors placeholder:text-monti-faint disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
				inline
					? cn(
							"h-auto rounded-monti-sm border-0 px-0",
							size !== "title" &&
								size !== "display" &&
								size !== "inherit" &&
								"focus-visible:ring-2 focus-visible:ring-monti-contrast/20",
						)
					: cn(
							// With an action the wrapper below draws the rule, the tint and the room; the input inside keeps none.
							!action && FIELD_HOVER,
							"border-0 border-monti-default border-b text-monti-default text-monti-reading focus-visible:border-monti-contrast aria-invalid:border-monti-danger data-proposal:border-monti-proposal data-proposal:border-b-[1.5px] data-proposal:text-monti-proposal md:text-monti-body",
							!action && FIELD_INSET,
						),
				inline ? INLINE_SIZE[size] : size === "sm" && "md:text-monti-note",
				// An underline field stands as high as a button of its size: 28px small, 32px medium (side panels), 36px otherwise, its rule inside. With an action the line around it holds the height.
				!inline &&
					(action
						? "h-full self-stretch py-0"
						: width === "choice"
							? "h-5 pt-0 pb-px md:text-monti-note"
							: cn("py-0", fieldHeight)),
				width === "short" && "w-monti-menu",
				(width === "number" || width === "choice") && "w-24",
				width === "fit" && "field-sizing-content w-auto min-w-[4ch]",
				mono && "font-mono",
				srOnly && "sr-only",
				align === "center" && "text-center",
				align === "end" && "text-right",
				action && "border-b-0 data-proposal:border-b-0",
				className,
			)}
			{...props}
		/>
	);
	if (!action || inline) return input;
	return (
		<div
			data-slot="input-line"
			className={cn(
				cn(
					FIELD_HOVER,
					"flex w-full min-w-0 border-monti-default border-b transition-colors focus-within:border-monti-contrast has-[[aria-invalid=true]]:border-monti-danger has-data-proposal:border-monti-proposal has-data-proposal:border-b-[1.5px]",
					FIELD_INSET,
				),
				"items-center",
				fieldHeight,
			)}
		>
			{input}
			<span className={cn(FIELD_ACTION, FIELD_ACTION_SIZE[size === "sm" ? "sm" : size === "md" ? "md" : "lg"])}>
				{action}
			</span>
		</div>
	);
}

export { Input };
