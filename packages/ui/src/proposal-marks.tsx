import type { ComponentProps } from "react";
import { cn } from "./cn";

/**
 * Text the assistant puts in, in the blue pencil: a pale blue background and blue letters. It stays until the proposal is accepted (the text is
 * then plain) or discarded (it goes away). The proposal blue is used for nothing else.
 */
function Ins({ className, ...props }: ComponentProps<"ins">) {
	return (
		<ins
			data-slot="ins"
			className={cn(
				"rounded-monti-sm bg-monti-proposal-muted box-decoration-clone px-[2px] py-px text-monti-proposal no-underline",
				className,
			)}
			{...props}
		/>
	);
}

/** Text the assistant takes out: blue with a line through it. */
function Del({ className, ...props }: ComponentProps<"del">) {
	return (
		<del
			data-slot="del"
			className={cn("text-monti-proposal line-through decoration-[1.5px] opacity-75", className)}
			{...props}
		/>
	);
}

/** Text that fills an empty place with a suggestion (the dimmed source of a translation): blue letters, no background. */
function Fill({ className, ...props }: ComponentProps<"span">) {
	return <span data-slot="fill" className={cn("text-monti-proposal", className)} {...props} />;
}

/**
 * The proposal being looked at: a blue line in the left margin of the text it is about. The proposals on other tabs have a blue dot by the tab's
 * name instead (`ChangeDot tone="proposal"`).
 */
function CurrentProposal({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="current-proposal"
			className={cn(
				"relative before:absolute before:top-monti-4 before:bottom-monti-4 before:-left-[18px] before:w-0.5 before:rounded-[2px] before:bg-(--monti-fg-proposal)",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * A run of text on the highlight background: the words a note to the assistant is about, or the words that differ between two versions. It sets
 * no color, so the text keeps its own.
 */
function Highlight({ className, ...props }: ComponentProps<"mark">) {
	return (
		<mark
			data-slot="highlight"
			className={cn("rounded-monti-sm bg-monti-highlight px-px text-inherit", className)}
			{...props}
		/>
	);
}

export { CurrentProposal, Del, Fill, Highlight, Ins };
