import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";
import { IconButton, IconButtonContext } from "./icon-button";
import { ArrowUp, Pen, TrashCan } from "./icons";

/** What the row tells its icon buttons. One object, so they do not render again for nothing. */
const SMALL_QUIET = { size: "xs", tone: "quiet" } as const;

/**
 * The row right under one message of a conversation: when it was sent (faint caption) and icon-only buttons (`children`, `IconButton`s: the row
 * makes them small and quiet, 24px with 14px icons; their names are tooltips). It sits on the message's side (`user` right, `assistant` left), pulled up into the thread's gap so showing it moves nothing. It
 * shows only while the pointer or the keyboard is on its message (the sibling just before it) or on the row, and always on touch
 * screens (no pointer to hover with).
 */
export function ChatMessageActions({
	author,
	time,
	className,
	children,
	...props
}: ComponentProps<"div"> & {
	author: "user" | "assistant";
	/** When the message was sent ("오후 3:12"). (cms-allow-korean: quotes the words) */
	time?: ReactNode;
}) {
	return (
		<div
			data-slot="chat-message-actions"
			data-author={author}
			className={cn(
				"-mt-monti-16 flex items-center gap-monti-2 opacity-0 pointer-coarse:opacity-100 transition-opacity focus-within:opacity-100 hover:opacity-100 motion-reduce:transition-none [:focus-within+&]:opacity-100 [:hover+&]:opacity-100",
				author === "user" ? "self-end" : "self-start",
				className,
			)}
			{...props}
		>
			{time !== undefined && <span className="px-monti-6 text-monti-caption text-monti-faint">{time}</span>}
			<IconButtonContext value={SMALL_QUIET}>{children}</IconButtonContext>
		</div>
	);
}

/**
 * One message the admin sent while the assistant was working: it waits in the queue over the text box (`ChatInput`'s `queue`) until the
 * assistant takes it in, then leaves and shows in the thread as a message. Its words (one line) and three small quiet icon buttons (24px): send
 * now (↑), edit (its words go back into the box), cancel (trash). The names are tooltips.
 */
export function ChatQueueItem({
	onSendNow,
	onEdit,
	onCancel,
	sendNowLabel,
	editLabel,
	cancelLabel,
	sendNowIcon = <ArrowUp />,
	editIcon = <Pen />,
	cancelIcon = <TrashCan />,
	className,
	children,
	...props
}: ComponentProps<"li"> & {
	onSendNow: () => void;
	onEdit: () => void;
	onCancel: () => void;
	sendNowLabel: string;
	editLabel: string;
	cancelLabel: string;
	sendNowIcon?: ReactNode;
	editIcon?: ReactNode;
	cancelIcon?: ReactNode;
}) {
	return (
		<li data-slot="chat-queue-item" className={cn("flex min-w-0 items-center gap-monti-2", className)} {...props}>
			<span className="min-w-0 flex-1 truncate text-monti-default text-monti-note">{children}</span>
			<IconButton size="xs" tone="quiet" label={sendNowLabel} onClick={onSendNow}>
				{sendNowIcon}
			</IconButton>
			<IconButton size="xs" tone="quiet" label={editLabel} onClick={onEdit}>
				{editIcon}
			</IconButton>
			<IconButton size="xs" tone="quiet" label={cancelLabel} onClick={onCancel}>
				{cancelIcon}
			</IconButton>
		</li>
	);
}
