"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";
import { cn } from "./cn";
import { FIELD_ACTION, FIELD_HOVER } from "./hover";
import { useProposalDescription } from "./proposal-cue";

/**
 * A field whose ends are fixed and only the middle is typed: faint mono text before and after the input, so it reads as one address
 * ("/" + "posts" + "/:slug"). The field is one shape, fixed parts included: the pointer's tint and the underline (ink with focus, danger when
 * `aria-invalid`, blue for a proposal) span the whole control, and the fixed parts keep their faint text. They cannot be
 * deleted, so errors such as a missing ":slug" cannot happen. A click anywhere in the field, on a fixed part or on empty space, puts the
 * caret at the end of the typed part. With `width="full"` (the default) the typed part takes the room the fixed parts leave, so its
 * underline runs to the field's end, as an input's does; with `width="fit"` it is as wide as its words (never under three characters), and the
 * suffix follows right after them: a short address ("/posts/:slug") reads as one line instead of two ends far apart. `action` is a control at the far end of the line (a regenerate button);
 * the underline runs under it too, like a select's caret.
 */
function Affix({
	prefix,
	suffix,
	suffixWords = false,
	action,
	proposal = false,
	width = "full",
	size = "default",
	className,
	...props
}: Omit<React.ComponentProps<"input">, "size" | "prefix"> & {
	/** Fixed text before the input. */
	prefix?: React.ReactNode;
	/** Fixed text after the input. */
	suffix?: React.ReactNode;
	/** The suffix is words, not an address ("/글 주소" for each entry's own address): in sans, at the field's end. */
	suffixWords?: boolean;
	/** A control at the end of the line. */
	action?: React.ReactNode;
	/** The assistant wrote this value and nobody has touched it yet: blue text and a 1.5px blue underline. */
	proposal?: boolean;
	/** `full` runs the typed part to the field's end; `fit` keeps it as wide as its words, the suffix right after. */
	width?: "full" | "fit";
	/** The field's height: `default` 36px (forms), `md` 32px (a side panel, among its other `md` fields). */
	size?: "default" | "md";
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
			data-size={size}
			onClick={focusInput}
			className={cn(
				// One shape: the tint under the pointer and the underline belong to the whole field, the fixed parts included (2026-11-24 소유자).
				FIELD_HOVER,
				"group/affix flex h-monti-control-md cursor-text items-center border-transparent border-b font-mono text-monti-body transition-colors focus-within:border-monti-contrast has-[:disabled]:cursor-default has-[[aria-invalid=true]]:border-monti-danger has-[:disabled]:opacity-45 data-proposal:border-monti-proposal data-proposal:border-b-[1.5px]",
				// The fixed text before the input has the field's inset; with none, the input's own is the only one, as in any other field.
				prefix && "pl-[var(--monti-field-start,var(--monti-space-8))]",
				className,
			)}
		>
			{prefix && <span className="shrink-0 whitespace-nowrap text-monti-subtle">{prefix}</span>}
			<InputPrimitive
				data-slot="affix-input"
				aria-description={useProposalDescription(proposal)}
				className={cn(
					"h-full min-w-[3ch] rounded-none border-0 bg-transparent px-monti-8 py-0 text-monti-default outline-none placeholder:font-sans placeholder:text-monti-faint group-data-proposal/affix:text-monti-proposal",
					width === "fit" ? "field-sizing-content flex-initial" : "flex-1",
					// The fixed parts touch the typed part, so the address reads as one ("example.com/articles"); a suffix of words keeps the room.
					prefix && "pl-0",
					suffix && !suffixWords && "pr-0",
				)}
				{...props}
			/>
			{suffix && (
				<span
					className={cn(
						"shrink-0 whitespace-nowrap text-monti-subtle",
						suffixWords && "pr-[var(--monti-field-end,var(--monti-space-8))] font-sans",
					)}
				>
					{suffix}
				</span>
			)}
			{action && <span className={cn("ml-auto cursor-auto self-center", FIELD_ACTION)}>{action}</span>}
		</div>
	);
}

export { Affix };
