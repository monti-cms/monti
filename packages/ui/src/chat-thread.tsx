import type { ComponentProps } from "react";
import { cn } from "./cn";

/**
 * The conversation of the assistant panel: its requests, each with what answered it, in a column 24px apart, padded 24, that sits at the bottom of
 * the panel just over the box to type in and scrolls up from there. It fills the panel's height. What goes inside an answer (tool lines, words, a
 * card) is spaced by the screen with `Stack`: 12px between them, tool lines with no gap. Before anything is asked it holds the requests to start
 * from (`Suggest`), at its foot like the rest.
 */
function ChatThread({ className, children, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="chat-thread"
			className={cn("flex min-h-0 flex-1 scroll-py-monti-8 flex-col-reverse overflow-auto", className)}
			{...props}
		>
			<div className="flex flex-col gap-monti-24 p-monti-24">{children}</div>
		</div>
	);
}

export { ChatThread };
