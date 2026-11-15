"use client";

import type * as React from "react";
import { cn } from "./cn";
import { useUiLabels } from "./labels";
import { Spinner } from "./spinner";
import { TextButton } from "./text-button";

const SIZE = {
	/** The label's type, on a field's label row beside the field's name. */
	micro: "text-monti-micro",
	/** The note's type: in a card, beside a button over a text, under a box. */
	note: "text-monti-note",
} as const;

type Size = keyof typeof SIZE;

/**
 * The assistant at work, where it works: a ring and "Generating" in the proposal blue, then "Stop" when the work can be stopped. Every AI task
 * says it in these words (a fill, a request at a place, a translation), and no seconds are counted. It takes the place of the button that
 * started the work, so the line keeps its height. Only the words are a live status; "Stop" is a plain text button beside them.
 */
function AiWorking({
	onStop,
	size = "note",
	className,
	...props
}: React.ComponentProps<"span"> & {
	/** Stops the work. Left out where it cannot be stopped: the line is the ring and the words. */
	onStop?: () => void;
	size?: Size;
}) {
	const labels = useUiLabels();
	return (
		<span
			data-slot="ai-working"
			className={cn("inline-flex items-center gap-monti-6 whitespace-nowrap", SIZE[size], className)}
			{...props}
		>
			<span role="status" className="inline-flex items-center gap-monti-6 text-monti-proposal">
				<Spinner className={size === "micro" ? "size-3" : undefined} />
				{labels.aiWorking}
			</span>
			{onStop ? (
				<>
					<span aria-hidden="true" className="text-monti-subtle">
						·
					</span>
					<TextButton
						size={size}
						// The press keeps the focus where it was (the caret in the field it fills).
						onMouseDown={(event) => event.preventDefault()}
						onClick={onStop}
					>
						{labels.aiStop}
					</TextButton>
				</>
			) : null}
		</span>
	);
}

/**
 * AI work that did not go, where it was asked: why, in one short red line (the admin's words, never the service's), then "Try again" when the
 * same work can be asked again. It stays until the work is asked again or what it was about changes. One line for every AI task: under a
 * field, in a request's card, beside "✦ Translate".
 */
function AiFailed({
	onRetry,
	retryLabel,
	size = "note",
	className,
	children,
	...props
}: React.ComponentProps<"div"> & {
	/** Asks the same again. Left out where nothing can be asked again (no key): the line is the reason alone. */
	onRetry?: () => void;
	/** The button's words when asking again is something else: "Go on" for work that stopped at its limit. */
	retryLabel?: string;
	size?: Size;
}) {
	const labels = useUiLabels();
	return (
		<div
			data-slot="ai-failed"
			className={cn("flex flex-wrap items-baseline gap-x-monti-8 gap-y-monti-2", SIZE[size], className)}
			{...props}
		>
			<span role="alert" className="min-w-0 text-monti-danger">
				{children}
			</span>
			{onRetry ? (
				<TextButton variant="underline" size={size} onMouseDown={(event) => event.preventDefault()} onClick={onRetry}>
					{retryLabel ?? labels.aiRetry}
				</TextButton>
			) : null}
		</div>
	);
}

export { AiFailed, AiWorking };
