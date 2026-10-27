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
	...props
}: React.ComponentProps<"textarea"> & {
	/** `sm` writes at the note size, for compact panels; `default` at the reading size on a phone and body size above. */
	size?: "sm" | "default";
	/** Fixed-width letters for code and source text. */
	mono?: boolean;
	/** The assistant wrote this text and nobody has touched it yet. Turn it off when the text is edited. */
	proposal?: boolean;
}) {
	return (
		<textarea
			data-slot="textarea"
			data-size={size}
			data-proposal={proposal || undefined}
			aria-description={useProposalDescription(proposal)}
			className={cn(
				"field-sizing-content flex w-full resize-none rounded-none border-0 border-monti-default border-b bg-transparent py-monti-6 text-monti-default outline-none transition-colors placeholder:text-monti-faint focus-visible:border-monti-contrast disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-monti-danger data-proposal:border-monti-proposal data-proposal:border-b-[1.5px] data-proposal:text-monti-proposal",
				size === "sm" ? "text-monti-note" : "text-monti-reading md:text-monti-body",
				mono && "font-mono",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
