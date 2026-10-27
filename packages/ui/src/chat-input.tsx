"use client";

import { Send, Square } from "lucide-react";
import type { ComponentProps, KeyboardEvent, ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { Textarea } from "./textarea";

/**
 * The box a conversation is typed in: a text area, and a send button that becomes a stop button while the answer is being written (`busy`). Enter sends,
 * Shift+Enter breaks the line (not while an input method is composing). `aside` sits at the start of the row under the box (what the conversation has used).
 * Nothing is sent while the text is blank or the box is `disabled`. The words are the app's.
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
			className={cn("flex flex-col gap-monti-8", className)}
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
			{...props}
		>
			<Textarea
				size="sm"
				aria-label={label}
				placeholder={placeholder}
				value={value}
				disabled={disabled}
				onChange={(event) => onValueChange(event.target.value)}
				onKeyDown={onKeyDown}
			/>
			<div className="flex items-center justify-between gap-monti-8">
				<div className="min-w-0">{aside}</div>
				{busy ? (
					<Button type="button" variant="outline" size="sm" onClick={onStop}>
						<Square aria-hidden />
						{stopLabel}
					</Button>
				) : (
					<Button type="submit" size="sm" disabled={blank || disabled}>
						<Send aria-hidden />
						{sendLabel}
					</Button>
				)}
			</div>
		</form>
	);
}
