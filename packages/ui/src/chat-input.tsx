"use client";

import { type ComponentProps, type KeyboardEvent, type ReactNode, useEffect, useRef } from "react";
import { cn } from "./cn";
import { letHeldKeyGo } from "./held-key";
import { IconButton } from "./icon-button";
import { ArrowUp, StopFilledAlt } from "./icons";

/**
 * The box a conversation is typed in: a rounded box with a text area, and under it a row with `aside` at the start (the model picker) and a round send
 * button at the end that becomes a stop button while the answer is being written (`busy`). `context` sits over the text: what the message will be about. Enter sends, Shift+Enter breaks the line (not while an input
 * method is composing). Nothing is sent while the text is blank or the box is `disabled`. The words are the app's.
 */
export function ChatInput({
	value,
	onValueChange,
	onSubmit,
	onStop,
	busy = false,
	disabled = false,
	label,
	placeholder,
	sendLabel,
	stopLabel,
	aside,
	context,
	queue,
	onQueue,
	busyPlaceholder,
	className,
	...props
}: Omit<ComponentProps<"form">, "onSubmit" | "children"> & {
	value: string;
	onValueChange: (value: string) => void;
	onSubmit: (value: string) => void;
	onStop: () => void;
	busy?: boolean;
	disabled?: boolean;
	/** The screen reader name of the box. */
	label: string;
	placeholder?: string;
	sendLabel: string;
	stopLabel: string;
	aside?: ReactNode;
	/** What the message will be about, over the text: a `Chip` of the picked rows ("2 picked ×"). */
	context?: ReactNode;
	/** The messages waiting while the assistant works: `ChatQueueItem`s, drawn as a card tucked behind the top of the box. */
	queue?: ReactNode;
	/** Set, and Enter while `busy` puts the words in the queue instead of doing nothing. */
	onQueue?: (value: string) => void;
	/** The placeholder while `busy` and the box can queue ("더 말하기"). (cms-allow-korean: quotes the words) */
	busyPlaceholder?: string;
}) {
	const blank = value.trim() === "";
	// The stop button gives way to the send button when the answer ends, and that one is off while the box is empty: a focus the keyboard
	// held on "stop" would fall to the page. It goes to the box, where the next thing is typed; a key still held does nothing there.
	const words = useRef<HTMLTextAreaElement>(null);
	const stopHeld = useRef(false);
	useEffect(() => {
		if (busy || !stopHeld.current) return;
		stopHeld.current = false;
		letHeldKeyGo();
		words.current?.focus();
	}, [busy]);
	const submit = () => {
		if (blank || disabled) return;
		if (!busy) onSubmit(value.trim());
		else if (onQueue) onQueue(value.trim());
	};
	const onKeyDown = (event: KeyboardEvent) => {
		// An Enter that ends a syllable being composed (Korean, Japanese, Chinese) is the input method's, not a send. Safari sends it after
		// the composition has ended, with `isComposing` false; its key code is still the input method's, 229.
		if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
		event.preventDefault();
		submit();
	};
	const form = (
		<form
			data-slot="chat-input"
			className={cn(
				// 24px round: the 28px model pill and the 32px send button sit 8px from its edges, so their curves run with its own. The typed words,
				// the queued ones and the model's name all start 18px in.
				"rounded-[24px] border border-monti-emphasis bg-monti-page px-monti-12 pt-monti-10 pb-monti-8 has-[textarea:disabled]:opacity-45",
				queue && "relative",
				className,
			)}
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
			{...props}
		>
			{context && <div className="-mt-monti-2 mb-monti-6 -ml-monti-4 flex flex-wrap gap-monti-6">{context}</div>}
			<textarea
				aria-label={label}
				placeholder={busy && onQueue && busyPlaceholder ? busyPlaceholder : placeholder}
				ref={words}
				value={value}
				disabled={disabled}
				rows={2}
				onChange={(event) => onValueChange(event.target.value)}
				onKeyDown={onKeyDown}
				className="field-sizing-content max-h-40 min-h-[calc(2lh+4px)] w-full resize-none border-0 bg-transparent py-monti-2 pr-0 pl-monti-6 text-monti-body text-monti-default outline-none placeholder:text-monti-faint"
			/>
			<div className="mt-monti-4 flex items-end justify-between gap-monti-8">
				<div className="min-w-0">{aside}</div>
				{busy ? (
					<IconButton
						variant="primary"
						label={stopLabel}
						onClick={onStop}
						className="-mr-monti-4"
						onFocus={(event) => {
							stopHeld.current = event.currentTarget.matches(":focus-visible");
						}}
						onBlur={() => {
							stopHeld.current = false;
						}}
					>
						<StopFilledAlt aria-hidden className="size-3" />
					</IconButton>
				) : (
					<IconButton
						variant="primary"
						type="submit"
						label={sendLabel}
						disabled={blank || disabled}
						className="-mr-monti-4"
					>
						<ArrowUp aria-hidden />
					</IconButton>
				)}
			</div>
		</form>
	);
	// One tree with or without waiting messages: the box is the same element when the card over it comes and goes, so the words being
	// typed keep their caret (a box made anew lost the focus each time a message was queued or taken).
	return (
		<div data-slot="chat-input-queue" className="flex flex-col">
			{queue ? (
				<ul className="-mb-[24px] flex flex-col gap-monti-4 rounded-t-[24px] border border-monti-default border-b-0 bg-monti-selected pt-monti-6 pr-monti-12 pb-[30px] pl-[18px]">
					{queue}
				</ul>
			) : null}
			{form}
		</div>
	);
}
