"use client";

import type * as React from "react";
import { cn } from "./cn";
import { FIELD_ACTION, FIELD_ACTION_BUTTON, FIELD_HOVER, FIELD_INSET } from "./hover";
import { IconButtonContext } from "./icon-button";
import { useProposalDescription } from "./proposal-cue";

/**
 * Several lines, drawn like `Input`: an underline, never a box. `proposal` marks text the assistant wrote and nobody has touched. `action` is a
 * control at the end of the first line (a button that makes the text again from the body); the underline then runs under it too. `rows` is the
 * fewest lines it shows: it grows with its text past them.
 */
function Textarea({
	className,
	size = "default",
	mono = false,
	proposal = false,
	tall = false,
	action,
	rows,
	style,
	...props
}: React.ComponentProps<"textarea"> & {
	/** `sm` writes at the note size, for compact panels; `default` at the reading size on a phone and body size above. */
	size?: "sm" | "md" | "default";
	/** Fixed-width letters for code and source text. */
	mono?: boolean;
	/** The assistant wrote this text and nobody has touched it yet. Turn it off when the text is edited. */
	proposal?: boolean;
	/** Two lines high (52px) while it is empty or short, then it grows: the help text of a field. */
	tall?: boolean;
	/** A control at the end of the first line. */
	action?: React.ReactNode;
}) {
	const textarea = (
		<textarea
			data-slot="textarea"
			data-size={size}
			data-proposal={proposal || undefined}
			aria-description={useProposalDescription(proposal)}
			className={cn(
				cn(
					!action && FIELD_HOVER,
					"field-sizing-content flex w-full resize-none rounded-none border-0 border-monti-default border-b bg-transparent text-monti-default outline-none transition-colors placeholder:text-monti-faint focus-visible:border-monti-contrast disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-monti-danger data-proposal:border-monti-proposal data-proposal:border-b-[1.5px] data-proposal:text-monti-proposal",
					!action && FIELD_INSET,
				),
				// The design system's textarea sets lines 1.6 times its size; the type role's own line height comes first, so the rule follows it.
				// One line stands as high as an `Input` of its size (28px small, 32px medium, 36px otherwise); more lines grow it downward.
				size === "sm"
					? "min-h-monti-control-sm py-[3px] text-monti-note leading-[1.6]"
					: size === "md"
						? "min-h-monti-control-md py-monti-4 text-monti-reading leading-[1.6] md:text-monti-body md:leading-[1.6]"
						: "min-h-monti-control-lg py-monti-6 text-monti-reading leading-[1.6] md:text-monti-body md:leading-[1.6]",
				mono && "font-mono",
				tall && "min-h-[52px]",
				// With an action the line around it draws the rule, so the box keeps the height less that 1px.
				action &&
					cn(
						"min-w-0 flex-1 border-b-0 data-proposal:border-b-0",
						size === "sm"
							? "min-h-[calc(var(--monti-height-control-sm)-1px)]"
							: size === "md"
								? "min-h-[calc(var(--monti-height-control-md)-1px)]"
								: "min-h-[calc(var(--monti-height-control-lg)-1px)]",
					),
				className,
			)}
			rows={rows}
			// The box grows with its text (`field-sizing`), so `rows` alone sets no height: it holds that many lines of 1.6 and its padding.
			style={
				rows === undefined
					? style
					: {
							minHeight: `max(calc(var(--monti-height-control-${size === "sm" ? "sm" : size === "md" ? "md" : "lg"}) - ${action ? 1 : 0}px), calc(${rows} * 1.6em + ${size === "sm" ? 7 : size === "md" ? 9 : 13}px))`,
							...style,
						}
			}
			{...props}
		/>
	);
	if (!action) return textarea;
	return (
		<div
			data-slot="textarea-line"
			className={cn(
				cn(
					FIELD_HOVER,
					"flex w-full min-w-0 border-monti-default border-b transition-colors focus-within:border-monti-contrast has-[[aria-invalid=true]]:border-monti-danger has-data-proposal:border-monti-proposal has-data-proposal:border-b-[1.5px]",
					FIELD_INSET,
				),
				"items-start",
			)}
		>
			{textarea}
			{/* A 32px button over a 28px or 32px line reaches past it above and below, as at a small `Input`, and does not grow the line. */}
			<span className={cn(FIELD_ACTION, "mt-monti-2")}>
				<IconButtonContext value={FIELD_ACTION_BUTTON[size === "sm" ? "sm" : size === "md" ? "md" : "lg"]}>
					{action}
				</IconButtonContext>
			</span>
		</div>
	);
}

export { Textarea };
