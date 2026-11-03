import { cva } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";
import { Spark } from "./spark";
import { TextButton } from "./text-button";

const chatMessageVariants = cva("min-w-0 text-monti-body whitespace-pre-wrap break-words", {
	variants: {
		/** The admin's own message is a paper bubble on the right; the assistant's answer is plain text with no background. */
		author: {
			user: "max-w-[85%] self-end rounded-monti-xl rounded-br-monti-sm border border-monti-default bg-monti-page px-[14px] py-monti-10 text-monti-default leading-[1.6]",
			assistant: "text-monti-default leading-[1.7]",
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
 * (`context`, "2 picked" in mono 11 over the words) or be a default request they pressed (`request`, a blue spark before the words).
 */
export function ChatMessage({
	author = "assistant",
	streaming,
	context,
	request = false,
	className,
	children,
	...props
}: ComponentProps<"div"> & {
	author?: "user" | "assistant";
	streaming?: boolean;
	/** What the admin's message was about, over its words: the rows they had picked. */
	context?: ReactNode;
	/** The admin pressed a default request: a blue spark before the words. */
	request?: boolean;
}) {
	return (
		<div
			data-slot="chat-message"
			data-author={author}
			aria-busy={streaming || undefined}
			className={cn(
				chatMessageVariants({ author, streaming: streaming || undefined }),
				context !== undefined && "flex flex-col items-start gap-monti-8",
				request && "flex items-center gap-monti-6",
				className,
			)}
			{...props}
		>
			{context !== undefined && <span className="text-monti-micro text-monti-subtle">{context}</span>}
			{request && <Spark className="size-[13px] shrink-0 text-monti-proposal" />}
			{context !== undefined || request ? <span>{children}</span> : children}
		</div>
	);
}

/**
 * The entries an answer names, as a numbered list under its words: each is a `ChatEntryLink`. Goes after the answer's `ChatMessage`, in the same
 * column of the answer.
 */
export function ChatEntryList({ className, ...props }: ComponentProps<"ol">) {
	return (
		<ol
			data-slot="chat-entry-list"
			className={cn("m-0 list-decimal pl-monti-20 text-monti-body text-monti-default *:py-[3px]", className)}
			{...props}
		/>
	);
}

/**
 * One entry in a `ChatEntryList`: its name as an underlined link in ink, which opens the entry in the editor (`href`, or the app's router link in
 * `render`, or `onClick`), and its slug after it in faint mono.
 */
export function ChatEntryLink({
	slug,
	href,
	render,
	onClick,
	children,
}: Pick<ComponentProps<typeof TextButton>, "href" | "render" | "onClick"> & {
	/** The entry's slug ("/edited-post"). */
	slug?: ReactNode;
	/** The entry's name. */
	children: ReactNode;
}) {
	return (
		<li data-slot="chat-entry-link">
			<TextButton variant="underline" href={href} render={render} onClick={onClick} className="text-monti-default">
				{children}
			</TextButton>
			{slug !== undefined && (
				<>
					{" "}
					<span className="font-mono text-monti-faint text-monti-meta">{slug}</span>
				</>
			)}
		</li>
	);
}
