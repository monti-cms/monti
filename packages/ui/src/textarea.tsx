"use client";

import type * as React from "react";
import { cn } from "./cn";
import { FIELD_HOVER, FIELD_INSET } from "./hover";
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
	size?: "sm" | "default";
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
					"field-sizing-content flex w-full resize-none rounded-none border-0 border-monti-default border-b bg-transparent py-monti-6 text-monti-default outline-none transition-colors placeholder:text-monti-faint focus-visible:border-monti-contrast disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-monti-danger data-proposal:border-monti-proposal data-proposal:border-b-[1.5px] data-proposal:text-monti-proposal",
					!action && FIELD_INSET,
				),
				// The design system's textarea sets lines 1.6 times its size; the type role's own line height comes first, so the rule follows it.
				size === "sm"
					? "text-monti-note leading-[1.6]"
					: "text-monti-reading leading-[1.6] md:text-monti-body md:leading-[1.6]",
				mono && "font-mono",
				tall && "min-h-[52px]",
				action && "min-w-0 flex-1 border-b-0 data-proposal:border-b-0",
				className,
			)}
			rows={rows}
			// The box grows with its text (`field-sizing`), so `rows` alone sets no height: it holds that many lines of 1.6 and its padding.
			style={rows === undefined ? style : { minHeight: `calc(${rows} * 1.6em + 12px)`, ...style }}
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
			<span className="shrink-0">{action}</span>
		</div>
	);
}

export { Textarea };
