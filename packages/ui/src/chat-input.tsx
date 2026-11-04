"use client";

import type { ComponentProps, KeyboardEvent, ReactNode } from "react";
import { cn } from "./cn";
import { SendButton } from "./send-button";

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
	/** The placeholder while `busy` and the box can queue ("더 말하기"). */
	busyPlaceholder?: string;
}) {
	const blank = value.trim() === "";
	const submit = () => {
		if (blank || disabled) return;
		if (!busy) onSubmit(value.trim());
		else if (onQueue) onQueue(value.trim());
	};
	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
		event.preventDefault();
		submit();
	};
	const form = (
		<form
			data-slot="chat-input"
			className={cn(
				"rounded-monti-xl border border-monti-emphasis bg-monti-page px-monti-12 pt-monti-10 pb-monti-8 has-[textarea:disabled]:opacity-45",
				queue && "relative",
				className,
			)}
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
			{...props}
		>
			{context && <div className="mb-monti-6 flex flex-wrap gap-monti-6">{context}</div>}
			<textarea
				aria-label={label}
				placeholder={busy && onQueue && busyPlaceholder ? busyPlaceholder : placeholder}
				value={value}
				disabled={disabled}
				rows={2}
				onChange={(event) => onValueChange(event.target.value)}
				onKeyDown={onKeyDown}
				className="field-sizing-content max-h-40 min-h-[calc(2lh+4px)] w-full resize-none border-0 bg-transparent px-0 py-monti-2 text-monti-body text-monti-default outline-none placeholder:text-monti-faint"
			/>
			<div className="mt-monti-4 flex items-center justify-between gap-monti-8">
				<div className="min-w-0">{aside}</div>
				{busy ? (
					<SendButton busy label={stopLabel} onClick={onStop} />
				) : (
					<SendButton type="submit" label={sendLabel} disabled={blank || disabled} />
				)}
			</div>
		</form>
	);
	if (!queue) return form;
	return (
		<div data-slot="chat-input-queue" className="flex flex-col">
			<ul className="mx-monti-12 -mb-monti-12 flex flex-col gap-monti-4 rounded-t-monti-xl border border-monti-default border-b-0 bg-monti-page pt-monti-6 pr-monti-6 pb-[18px] pl-monti-12">
				{queue}
			</ul>
			{form}
		</div>
	);
}
