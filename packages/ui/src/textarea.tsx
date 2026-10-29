"use client";

import type * as React from "react";
import { cn } from "./cn";
import { useProposalDescription } from "./proposal-cue";

/** Several lines, drawn like `Input`: an underline, never a box. `proposal` marks text the assistant wrote and nobody has touched. */
function Textarea({
	className,
	size = "default",
	mono = false,
	proposal = false,
	tall = false,
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
}) {
	return (
		<textarea
			data-slot="textarea"
			data-size={size}
			data-proposal={proposal || undefined}
			aria-description={useProposalDescription(proposal)}
			className={cn(
				"field-sizing-content flex w-full resize-none rounded-none border-0 border-monti-default border-b bg-transparent py-monti-6 text-monti-default outline-none transition-colors placeholder:text-monti-faint focus-visible:border-monti-contrast disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-monti-danger data-proposal:border-monti-proposal data-proposal:border-b-[1.5px] data-proposal:text-monti-proposal",
				// The design system's textarea sets lines 1.6 times its size; the type role's own line height comes first, so the rule follows it.
				size === "sm"
					? "text-monti-note leading-[1.6]"
					: "text-monti-reading leading-[1.6] md:text-monti-body md:leading-[1.6]",
				mono && "font-mono",
				tall && "min-h-[52px]",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
