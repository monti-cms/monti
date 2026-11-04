"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";
import { cn } from "./cn";
import { FIELD_ACTION } from "./hover";
import { useProposalDescription } from "./proposal-cue";

/**
 * A field whose ends are fixed and only the middle is typed: faint mono text before and after the input, so it reads as one address
 * ("/" + "posts" + "/:slug"). The underline is under the typed part only; the fixed parts are plain text with no line, and they cannot be
 * deleted, so errors such as a missing ":slug" cannot happen. A click anywhere in the field, on a fixed part or on empty space, puts the
 * caret at the end of the typed part. With `width="full"` (the default) the typed part takes the room the fixed parts leave, so its
 * underline runs to the field's end, as an input's does; with `width="fit"` it is as wide as its words (never under three characters), and the
 * suffix follows right after them: a short address ("/posts/:slug") reads as one line instead of two ends far apart. `action` is a control at the far end of the line (a regenerate button). With no fixed part (a slug alone), the whole
 * line is typed, so the underline runs the full width, under the action too, like a select's caret.
 */
function Affix({
	prefix,
	suffix,
	action,
	proposal = false,
	width = "full",
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
	/** `full` runs the typed part to the field's end; `fit` keeps it as wide as its words, the suffix right after. */
	width?: "full" | "fit";
}) {
	// A click on the field's own text or empty space goes to the input; a click on the action, or on the input itself, is left alone.
	const focusInput = (event: React.MouseEvent<HTMLDivElement>) => {
		const target = event.target as Element;
		const input = event.currentTarget.querySelector<HTMLInputElement>('[data-slot="affix-input"]');
		if (!input || input.disabled || target === input || target.closest("button, a, [role=button]")) return;
		input.focus();
		input.setSelectionRange(input.value.length, input.value.length);
	};
	const bare = !prefix && !suffix;
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: a pointer shortcut to the input; the keyboard reaches the input itself (one Tab stop).
		<div
			data-slot="affix"
			data-proposal={proposal || undefined}
			onClick={focusInput}
			className={cn(
				cn(
					"group/affix flex h-monti-control-md cursor-text items-center pl-monti-8 font-mono text-monti-body has-[:disabled]:cursor-default has-[:disabled]:opacity-45",
				),
				bare &&
					"border-monti-default border-b transition-colors focus-within:border-monti-contrast has-[[aria-invalid=true]]:border-monti-danger data-proposal:border-monti-proposal data-proposal:border-b-[1.5px]",
				className,
			)}
		>
			{prefix && <span className="shrink-0 whitespace-nowrap text-monti-subtle">{prefix}</span>}
			<InputPrimitive
				data-slot="affix-input"
				aria-description={useProposalDescription(proposal)}
				className={cn(
					"h-full min-w-[3ch] rounded-none border-0 border-monti-default border-b bg-transparent px-monti-8 py-0 text-monti-default outline-none transition-colors placeholder:text-monti-faint focus:border-monti-contrast group-hover/affix:not-focus:not-disabled:border-monti-strong group-hover/affix:not-focus:not-disabled:bg-monti-muted aria-[invalid=true]:border-monti-danger group-data-proposal/affix:border-monti-proposal group-data-proposal/affix:border-b-[1.5px] group-data-proposal/affix:text-monti-proposal",
					width === "fit" ? "field-sizing-content flex-initial" : "flex-1",
					bare && "min-w-0 border-b-0 group-data-proposal/affix:border-b-0",
				)}
				{...props}
			/>
			{suffix && <span className="shrink-0 whitespace-nowrap text-monti-subtle">{suffix}</span>}
			{action && <span className={cn("ml-auto cursor-auto self-center", FIELD_ACTION)}>{action}</span>}
		</div>
	);
}

export { Affix };
