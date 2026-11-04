import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";
import { IconButton } from "./icon-button";
import { ArrowUp, Edit, List, TrashCan } from "./icons";

/**
 * The row right under one message of a conversation: when it was sent (faint caption) and icon-only buttons (`IconButton`s at 24px with 14px icons; their
 * names are tooltips). It sits on the message's side (`user` right, `assistant` left), pulled up into the thread's gap so showing it moves nothing. It
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
	/** When the message was sent ("오후 3:12"). */
	time?: ReactNode;
}) {
	return (
		<div
			data-slot="chat-message-actions"
			data-author={author}
			className={cn(
				"-mt-monti-16 flex items-center gap-monti-2 opacity-0 pointer-coarse:opacity-100 transition-opacity focus-within:opacity-100 hover:opacity-100 motion-reduce:transition-none [&_[data-slot=icon-button]:hover]:text-monti-default [&_[data-slot=icon-button]]:size-[24px] [&_[data-slot=icon-button]]:text-monti-faint [&_svg]:size-[14px] [:focus-within+&]:opacity-100 [:hover+&]:opacity-100",
				author === "user" ? "self-end" : "self-start",
				className,
			)}
			{...props}
		>
			{time !== undefined && <span className="px-monti-6 text-monti-caption text-monti-faint">{time}</span>}
			{children}
		</div>
	);
}

/**
 * One message the admin sent while the assistant was working: it waits in the queue over the text box (`ChatInput`'s `queue`) until the
 * assistant takes it in, then leaves and shows in the thread as a message. A queue mark, its words (one line) and three icon buttons: send
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
	editIcon = <Edit />,
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
		<li
			data-slot="chat-queue-item"
			className={cn(
				"flex min-w-0 items-center gap-monti-2 [&_[data-slot=icon-button]:hover]:text-monti-default [&_[data-slot=icon-button]]:size-[22px] [&_[data-slot=icon-button]]:text-monti-faint [&_svg]:size-[12px]",
				className,
			)}
			{...props}
		>
			<List aria-hidden className="text-monti-faint" />
			<span className="min-w-0 flex-1 truncate pl-monti-4 text-monti-default text-monti-note">{children}</span>
			<IconButton label={sendNowLabel} onClick={onSendNow}>
				{sendNowIcon}
			</IconButton>
			<IconButton label={editLabel} onClick={onEdit}>
				{editIcon}
			</IconButton>
			<IconButton label={cancelLabel} onClick={onCancel}>
				{cancelIcon}
			</IconButton>
		</li>
	);
}
