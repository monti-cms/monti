"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";
import { cn } from "./cn";
import { useProposalDescription } from "./proposal-cue";

/**
 * A field whose ends are fixed and only the middle is typed: faint mono text before and after the input, under one underline, so it reads as
 * one address ("/" + "posts" + "/:slug"). The fixed parts cannot be deleted, so errors such as a missing ":slug" cannot happen.
 * `action` is a control at the far end of the line (a regenerate button).
 */
function Affix({
	prefix,
	suffix,
	action,
	proposal = false,
	className,
	...props
}: Omit<React.ComponentProps<"input">, "size" | "prefix"> & {
	/** Fixed text before the input. */
	prefix?: React.ReactNode;
	/** Fixed text after the input. */
	suffix?: React.ReactNode;
	/** A control at the end of the line. */
	action?: React.ReactNode;
	/** The assistant wrote this value and nobody has touched it yet: blue text and a 1.5px blue underline. */
	proposal?: boolean;
}) {
	return (
		<div
			data-slot="affix"
			data-proposal={proposal || undefined}
			className={cn(
				"group/affix flex items-baseline border-monti-default border-b font-mono text-monti-body transition-colors focus-within:border-monti-contrast has-[[aria-invalid=true]]:border-monti-danger has-[:disabled]:opacity-45 data-proposal:border-monti-proposal data-proposal:border-b-[1.5px]",
				className,
			)}
		>
			{prefix && <span className="whitespace-nowrap py-monti-6 text-monti-subtle">{prefix}</span>}
			<InputPrimitive
				data-slot="affix-input"
				aria-description={useProposalDescription(proposal)}
				className="field-sizing-content min-w-[2ch] flex-initial rounded-none border-0 bg-transparent px-px py-monti-6 text-monti-default outline-none placeholder:text-monti-faint group-data-proposal/affix:text-monti-proposal"
				{...props}
			/>
			{suffix && <span className="whitespace-nowrap py-monti-6 text-monti-subtle">{suffix}</span>}
			{action && <span className="ml-auto self-center">{action}</span>}
		</div>
	);
}

export { Affix };
