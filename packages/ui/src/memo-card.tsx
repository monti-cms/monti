"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type { ComponentProps, KeyboardEvent, ReactElement, ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { IconButton } from "./icon-button";
import { ArrowUp, StopFilledAlt } from "./icons";
import { MENU_CARD, MENU_MOTION } from "./menu-parts";
import type { ShortcutKeys } from "./shortcut";
import { Spark } from "./spark";
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
 * The card that opens under a mark in the text: a note left for the assistant, or a source that changed. Three parts. The head (48px) holds the two ways
 * to deal with it, always in this order: a quiet text to discard, then one black pill to accept, after what kind of note it is when the place does not say
 * so (`where`, "Source changed"). The card hangs right under its words, so the head does not name the paragraph. A note with nothing to deal with yet
 * (words just selected to ask about) has no head, and opens on its reply row with the caret in it (`reply.focus`). While the assistant works on what
 * was sent, the reply row's button stops it (`reply.stop`). There is no close
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
	/** What kind of note it is, when the place does not say so ("Source changed"). */
	where?: string;
	discardLabel?: string;
	onDiscard?: () => void;
	discardShortcut?: ShortcutKeys;
	acceptLabel?: string;
	onAccept?: () => void;
	acceptShortcut?: ShortcutKeys;
	/** A spark before the accept label: accepting asks the assistant to do something ("✦ Translate again"). */
	acceptSpark?: boolean;
	reply?: {
		placeholder: string;
		value: string;
		onValueChange: (value: string) => void;
		onSend: (value: string) => void;
		sendLabel: string;
		/** Puts the caret in the box when the card opens: the card is there to be written in. */
		focus?: boolean;
		/** While the assistant works on what was sent: the send button is the stop button (a square), as in the chat. */
		stop?: { label: string; onStop: () => void };
	};
	children?: ReactNode;
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
			{(where || onDiscard || onAccept) && (
				<div className="flex h-monti-toolbar items-center gap-monti-16 border-monti-muted border-b pr-monti-10 pl-monti-16">
					<span className="grow text-monti-caption text-monti-subtle">{where}</span>
					{discardLabel && onDiscard && (
						<WithShortcut label={discardLabel} shortcut={discardShortcut}>
							<Button variant="ghost" size="sm" onClick={onDiscard}>
								{discardLabel}
							</Button>
						</WithShortcut>
					)}
					{acceptLabel && onAccept && (
						<WithShortcut label={acceptLabel} shortcut={acceptShortcut}>
							<Button size="sm" onClick={onAccept}>
								{acceptSpark && <Spark className="size-monti-icon-xs" />}
								{acceptLabel}
							</Button>
						</WithShortcut>
					)}
				</div>
			)}
			{children}
			{reply && (
				<div className="flex min-h-monti-toolbar items-center gap-monti-8 border-monti-muted border-t pr-monti-10 pl-monti-16">
					<input
						// biome-ignore lint/a11y/noAutofocus: a card opened to be written in (`reply.focus`) takes the caret, as the board draws it
						autoFocus={reply.focus}
						aria-label={reply.placeholder}
						placeholder={reply.placeholder}
						value={reply.value}
						onChange={(event) => reply.onValueChange(event.target.value)}
						onKeyDown={onKeyDown}
						className="min-w-0 grow border-0 bg-transparent p-0 text-monti-body text-monti-default outline-none placeholder:text-monti-faint"
					/>
					{reply.stop ? (
						<IconButton variant="primary" size="sm" label={reply.stop.label} onClick={reply.stop.onStop}>
							<StopFilledAlt aria-hidden className="size-3" />
						</IconButton>
					) : (
						<IconButton variant="primary" size="sm" label={reply.sendLabel} disabled={blank} onClick={send}>
							<ArrowUp aria-hidden className="size-3.5" />
						</IconButton>
					)}
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
 * `Highlight`. A block that is new in the source has no before: leave out `before` and `beforeLabel`, and only the after line shows.
 */
function MemoDiff({
	beforeLabel,
	afterLabel,
	before,
	after,
	className,
	...props
}: Omit<ComponentProps<"div">, "children"> & {
	beforeLabel?: string;
	afterLabel: string;
	before?: ReactNode;
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
			{before === undefined ? null : (
				<>
					<span className="text-monti-caption text-monti-faint">{beforeLabel}</span>
					<span className="text-monti-body text-monti-muted">{before}</span>
				</>
			)}
			<span className="text-monti-caption text-monti-faint">{afterLabel}</span>
			<span className="text-monti-body">{after}</span>
		</div>
	);
}

/**
 * A `MemoCard` opened under a place in the text: `anchor` finds the element it hangs from (the block of a mark), 8px below its start. It is asked again
 * whenever the card is placed, so a block the editor draws anew keeps its card. Pressing outside or Esc
 * closes it through `onOpenChange`.
 */
function MemoCardPopover({
	anchor,
	open,
	onOpenChange,
	...card
}: ComponentProps<typeof MemoCard> & {
	anchor: () => Element | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Positioner
					anchor={anchor}
					side="bottom"
					align="start"
					sideOffset={8}
					className="isolate z-50"
				>
					{/* The text keeps the focus: the card opens beside what is being read, and its buttons are a press away. */}
					<PopoverPrimitive.Popup render={<MemoCard {...card} />} className={MENU_MOTION} initialFocus={false} />
				</PopoverPrimitive.Positioner>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}

export { MemoCard, MemoCardPopover, MemoDiff, MemoMessage, MemoThread };
