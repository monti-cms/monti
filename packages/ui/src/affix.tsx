"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";
import { cn } from "./cn";
import { useProposalDescription } from "./proposal-cue";

/**
 * A field whose ends are fixed and only the middle is typed: faint mono text before and after the input, so it reads as one address
 * ("/" + "posts" + "/:slug"). The underline is under the typed part only; the fixed parts are plain text with no line, and they cannot be
 * deleted, so errors such as a missing ":slug" cannot happen. A click anywhere in the field, on a fixed part or on empty space, puts the
 * caret at the end of the typed part. The typed part is as wide as its text, and never narrower than three characters, so an empty value still
 * shows a line to click. `action` is a control at the far end of the line (a regenerate button).
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
	// A click on the field's own text or empty space goes to the input; a click on the action, or on the input itself, is left alone.
	const focusInput = (event: React.MouseEvent<HTMLDivElement>) => {
		const target = event.target as Element;
		const input = event.currentTarget.querySelector<HTMLInputElement>('[data-slot="affix-input"]');
		if (!input || input.disabled || target === input || target.closest("button, a, [role=button]")) return;
		input.focus();
		input.setSelectionRange(input.value.length, input.value.length);
	};
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: a pointer shortcut to the input; the keyboard reaches the input itself (one Tab stop).
		<div
			data-slot="affix"
			data-proposal={proposal || undefined}
			onClick={focusInput}
			className={cn(
				"group/affix flex cursor-text items-baseline font-mono text-monti-body has-[:disabled]:cursor-default has-[:disabled]:opacity-45",
				className,
			)}
		>
			{prefix && <span className="whitespace-nowrap py-monti-6 text-monti-subtle">{prefix}</span>}
			<InputPrimitive
				data-slot="affix-input"
				aria-description={useProposalDescription(proposal)}
				className="field-sizing-content min-w-[3ch] flex-initial rounded-none border-0 border-monti-default border-b bg-transparent px-px py-monti-6 text-monti-default outline-none transition-colors placeholder:text-monti-faint focus:border-monti-contrast aria-[invalid=true]:border-monti-danger group-data-proposal/affix:border-monti-proposal group-data-proposal/affix:border-b-[1.5px] group-data-proposal/affix:text-monti-proposal"
				{...props}
			/>
			{suffix && <span className="whitespace-nowrap py-monti-6 text-monti-subtle">{suffix}</span>}
			{action && <span className="ml-auto cursor-auto self-center">{action}</span>}
		</div>
	);
}

export { Affix };
