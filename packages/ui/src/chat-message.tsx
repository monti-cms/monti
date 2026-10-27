import { cva } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./cn";

const chatMessageVariants = cva("min-w-0 text-monti-body whitespace-pre-wrap break-words", {
	variants: {
		/** The admin's own message is a paper bubble on the right; the assistant's answer is plain text with no background. */
		author: {
			user: "max-w-[85%] self-end rounded-monti-xl rounded-br-monti-sm border border-monti-default bg-monti-page px-[14px] py-monti-10 text-monti-default",
			assistant: "text-monti-default",
		},
		/** The answer is still arriving: a small blinking mark after the last word. */
		streaming: {
			true: "after:ml-monti-4 after:inline-block after:h-3.5 after:w-1.5 after:translate-y-0.5 after:animate-pulse after:rounded-monti-sm after:bg-monti-emphasis after:content-[''] motion-reduce:after:animate-none",
		},
	},
	defaultVariants: { author: "assistant" },
});

/**
 * One message of a conversation: what the admin asked (`user`, a bubble at the right) or what the assistant answered (`assistant`, plain text, `streaming`
 * while it is still being written). Put them in a column; the bubble moves to the right edge of it.
 */
export function ChatMessage({
	author = "assistant",
	streaming,
	className,
	...props
}: ComponentProps<"div"> & { author?: "user" | "assistant"; streaming?: boolean }) {
	return (
		<div
			data-slot="chat-message"
			data-author={author}
			aria-busy={streaming || undefined}
			className={cn(chatMessageVariants({ author, streaming: streaming || undefined }), className)}
			{...props}
		/>
	);
}
