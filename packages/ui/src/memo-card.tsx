"use client";

import type { ComponentProps, KeyboardEvent, ReactElement, ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { MENU_CARD } from "./menu-parts";
import { SendButton } from "./send-button";
import type { ShortcutKeys } from "./shortcut";
import { Spark } from "./spark";
import { TextButton } from "./text-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/** A button of the card's head that tells its key combination in a tooltip after its name, and only there. */
function WithShortcut({
	label,
	shortcut,
	children,
}: {
	label: string;
	shortcut?: ShortcutKeys;
	children: ReactElement;
}) {
	if (!shortcut) return children;
	return (
		<Tooltip>
			<TooltipTrigger render={children} />
			<TooltipContent side="top" shortcut={shortcut}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}

/**
 * The card that opens under a mark in the text: a note left for the assistant, or a source that changed. Three parts. The head (48px) says where the
 * note is and holds the two ways to deal with it, always in this order: a quiet text to discard, then one black pill to accept. There is no close
 * button; pressing outside, Esc, or the mark again closes it. The body is a `MemoThread` of messages or a `MemoDiff`. `reply` adds the row at the
 * bottom where the note goes on ("Continue"). The key combinations show as tooltips on the head's buttons.
 */
function MemoCard({
	where,
	discardLabel,
	onDiscard,
	discardShortcut,
	acceptLabel,
	onAccept,
	acceptShortcut,
	acceptSpark = false,
	reply,
	className,
	children,
	...props
}: Omit<ComponentProps<"div">, "children"> & {
	/** Where the note is ("Request · paragraph 4"). */
	where: string;
	discardLabel: string;
	onDiscard: () => void;
	discardShortcut?: ShortcutKeys;
	acceptLabel: string;
	onAccept: () => void;
	acceptShortcut?: ShortcutKeys;
	/** A spark before the accept label: accepting asks the assistant to do something ("✦ Translate again"). */
	acceptSpark?: boolean;
	reply?: {
		placeholder: string;
		value: string;
		onValueChange: (value: string) => void;
		onSend: (value: string) => void;
		sendLabel: string;
	};
	children: ReactNode;
}) {
	const blank = reply ? reply.value.trim() === "" : true;
	const send = () => {
		if (reply && !blank) reply.onSend(reply.value.trim());
	};
	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
		event.preventDefault();
		send();
	};
	return (
		<div data-slot="memo-card" className={cn(MENU_CARD, "w-[420px] max-w-full overflow-hidden", className)} {...props}>
			<div className="flex h-12 items-center gap-monti-16 border-monti-muted border-b pr-monti-10 pl-monti-16">
				<span className="grow text-monti-caption text-monti-subtle">{where}</span>
				<WithShortcut label={discardLabel} shortcut={discardShortcut}>
					<TextButton className="text-monti-note" onClick={onDiscard}>
						{discardLabel}
					</TextButton>
				</WithShortcut>
				<WithShortcut label={acceptLabel} shortcut={acceptShortcut}>
					<Button size="sm" onClick={onAccept}>
						{acceptSpark && <Spark className="size-monti-icon-xs" />}
						{acceptLabel}
					</Button>
				</WithShortcut>
			</div>
			{children}
			{reply && (
				<div className="flex min-h-12 items-center gap-monti-8 border-monti-muted border-t pr-monti-10 pl-monti-16">
					<input
						aria-label={reply.placeholder}
						placeholder={reply.placeholder}
						value={reply.value}
						onChange={(event) => reply.onValueChange(event.target.value)}
						onKeyDown={onKeyDown}
						className="min-w-0 grow border-0 bg-transparent p-0 text-monti-body text-monti-default outline-none placeholder:text-monti-faint"
					/>
					<SendButton size="sm" label={reply.sendLabel} disabled={blank} onClick={send} />
				</div>
			)}
		</div>
	);
}

/** The messages of a note, 16px apart. */
function MemoThread({ className, ...props }: ComponentProps<"div">) {
	return <div data-slot="memo-thread" className={cn("flex flex-col gap-monti-16 p-monti-16", className)} {...props} />;
}

/**
 * One message of a note: the name in bold with the time faint beside it, then the text. The assistant's name (`ai`) is blue with a spark; while it works
 * the text can be "…".
 */
function MemoMessage({
	author,
	time,
	ai = false,
	children,
}: {
	author: string;
	time?: string;
	ai?: boolean;
	children?: ReactNode;
}) {
	return (
		<div data-slot="memo-message" data-ai={ai || undefined} className="flex flex-col gap-monti-4">
			<span className="flex items-center gap-monti-6 text-monti-caption text-monti-faint">
				<b
					className={cn(
						"inline-flex items-center gap-monti-4 font-semibold",
						ai ? "text-monti-proposal" : "text-monti-muted",
					)}
				>
					{ai && <Spark className="size-monti-icon-xs" />}
					{author}
				</b>
				{time}
			</span>
			{children && <span className="block text-monti-body">{children}</span>}
		</div>
	);
}

/**
 * The body of a card about a changed source: the text before and after, two lines with their names in the margin. Mark the words that differ with
 * `Highlight`.
 */
function MemoDiff({
	beforeLabel,
	afterLabel,
	before,
	after,
	className,
	...props
}: Omit<ComponentProps<"div">, "children"> & {
	beforeLabel: string;
	afterLabel: string;
	before: ReactNode;
	after: ReactNode;
}) {
	return (
		<div
			data-slot="memo-diff"
			className={cn(
				"grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-monti-12 gap-y-monti-8 p-monti-16",
				className,
			)}
			{...props}
		>
			<span className="text-monti-caption text-monti-faint">{beforeLabel}</span>
			<span className="text-monti-body text-monti-muted">{before}</span>
			<span className="text-monti-caption text-monti-faint">{afterLabel}</span>
			<span className="text-monti-body">{after}</span>
		</div>
	);
}

export { MemoCard, MemoDiff, MemoMessage, MemoThread };
