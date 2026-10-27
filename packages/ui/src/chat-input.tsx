"use client";

import type { ComponentProps, KeyboardEvent, ReactNode } from "react";
import { cn } from "./cn";
import { SendButton } from "./send-button";

/**
 * The box a conversation is typed in: a rounded box with a text area, and under it a row with `aside` at the start (the model picker) and a round send
 * button at the end that becomes a stop button while the answer is being written (`busy`). Enter sends, Shift+Enter breaks the line (not while an input
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
}) {
	const blank = value.trim() === "";
	const submit = () => {
		if (!blank && !busy && !disabled) onSubmit(value.trim());
	};
	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
		event.preventDefault();
		submit();
	};
	return (
		<form
			data-slot="chat-input"
			className={cn(
				"rounded-monti-xl border border-monti-emphasis bg-monti-page px-monti-12 pt-monti-10 pb-monti-8 has-disabled:opacity-45",
				className,
			)}
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
			{...props}
		>
			<textarea
				aria-label={label}
				placeholder={placeholder}
				value={value}
				disabled={disabled}
				rows={2}
				onChange={(event) => onValueChange(event.target.value)}
				onKeyDown={onKeyDown}
				className="field-sizing-content max-h-40 min-h-10 w-full resize-none border-0 bg-transparent px-0 py-monti-2 text-monti-body text-monti-default outline-none placeholder:text-monti-faint"
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
}
