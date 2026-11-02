import type { ComponentProps } from "react";
import { cn } from "./cn";

/**
 * The conversation of the assistant panel: its messages, tool lines and notices in a column 24px apart, padded 24, that sits at the bottom of the panel
 * just over the box to type in and scrolls up from there. It fills the panel's height.
 */
function ChatThread({ className, children, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="chat-thread"
			className={cn("flex min-h-0 flex-1 flex-col-reverse overflow-auto", className)}
			{...props}
		>
			<div className="flex flex-col gap-monti-24 p-monti-24">{children}</div>
		</div>
	);
}

/** The day a conversation opened again was had ("10. 24 (금)"), centered over its messages in mono 11. */
function ChatDate({ className, ...props }: ComponentProps<"span">) {
	return (
		<span
			data-slot="chat-date"
			className={cn("self-center text-monti-micro text-monti-subtle", className)}
			{...props}
		/>
	);
}

/** One answer of the assistant: its tool lines, its words, a card, in a column 12px apart. */
function ChatAnswer({ className, ...props }: ComponentProps<"div">) {
	return <div data-slot="chat-answer" className={cn("flex min-w-0 flex-col gap-monti-12", className)} {...props} />;
}

/** The tool lines of an answer, one under the other. */
function ToolCallLines({ className, ...props }: ComponentProps<"div">) {
	return <div data-slot="tool-call-lines" className={cn("flex min-w-0 flex-col", className)} {...props} />;
}

export { ChatAnswer, ChatDate, ChatThread, ToolCallLines };
