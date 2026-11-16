import { cva } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

const chatMessageVariants = cva("min-w-0 text-monti-body whitespace-pre-wrap break-words", {
	variants: {
		/** The admin's own message is a paper bubble on the right; the assistant's answer is plain text with no background. */
		author: {
			user: "max-w-[85%] self-end rounded-monti-xl rounded-br-monti-sm border border-monti-default bg-monti-page px-[14px] py-monti-10 text-monti-default text-monti-prose",
			assistant: "text-monti-default text-monti-prose",
		},
		/** The answer is still arriving: a thin blinking caret after the last word, the height of the text. */
		streaming: {
			true: "after:ml-monti-2 after:inline-block after:h-[1.15em] after:w-0.5 after:animate-pulse after:rounded-[1px] after:bg-(--monti-fg-default) after:align-text-bottom after:content-[''] motion-reduce:after:animate-none",
		},
	},
	defaultVariants: { author: "assistant" },
});

/**
 * One message of a conversation: what the admin asked (`user`, a bubble at the right) or what the assistant answered (`assistant`, plain text, `streaming`
 * while it is still being written). Put them in a column; the bubble moves to the right edge of it. A message of the admin can say what it was about
 * (`context`, "2 picked" over the words). How the words were sent (typed, or a screen's default request pressed) is not marked: the words say it.
 */
export function ChatMessage({
	author = "assistant",
	streaming,
	context,
	className,
	children,
	...props
}: ComponentProps<"div"> & {
	author?: "user" | "assistant";
	streaming?: boolean;
	/** What the admin's message was about, over its words: the rows they had picked. */
	context?: ReactNode;
}) {
	return (
		<div
			data-slot="chat-message"
			data-author={author}
			aria-busy={streaming || undefined}
			className={cn(
				chatMessageVariants({ author, streaming: streaming || undefined }),
				context !== undefined && "flex flex-col items-start gap-monti-8",
				className,
			)}
			{...props}
		>
			{context !== undefined && <span className="text-monti-micro text-monti-subtle">{context}</span>}
			{context !== undefined ? <span>{children}</span> : children}
		</div>
	);
}

/**
 * The caret of an answer still arriving: a thin blinking bar the height of the text, after the last word. It stands inside the last line of the answer's
 * words (`ReadBody streaming`), not after the box, so it never takes a line of its own.
 */
export function StreamCaret() {
	return (
		<span
			aria-hidden
			data-slot="stream-caret"
			className="ml-monti-2 inline-block h-[1.15em] w-0.5 animate-pulse rounded-[1px] bg-(--monti-fg-default) align-text-bottom motion-reduce:animate-none"
		/>
	);
}
