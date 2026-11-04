import type { ComponentProps } from "react";
import { cn } from "./cn";

/**
 * The classes of the blue pencil, for a place that cannot render the components: the editor draws proposals as decorations on its own text (`ins` and `del`
 * on runs of text, `current` on the block whose proposal is being looked at, `anchor` on the words a request is attached to).
 */
export const PROPOSAL_MARK_CLASSES = {
	ins: "rounded-monti-sm bg-monti-proposal-muted box-decoration-clone px-[2px] py-px text-monti-proposal no-underline",
	del: "text-monti-proposal line-through decoration-[1.5px] opacity-75",
	current:
		"relative before:absolute before:top-monti-4 before:bottom-monti-4 before:-left-[18px] before:w-0.5 before:rounded-[2px] before:bg-(--monti-fg-proposal)",
	anchor: "underline decoration-monti-proposal decoration-dotted decoration-2 underline-offset-[5px]",
} as const;

/**
 * Text the assistant puts in, in the blue pencil: a pale blue background and blue letters. It stays until the proposal is accepted (the text is
 * then plain) or discarded (it goes away). The proposal blue is used for nothing else.
 */
function Ins({ className, ...props }: ComponentProps<"ins">) {
	return <ins data-slot="ins" className={cn(PROPOSAL_MARK_CLASSES.ins, className)} {...props} />;
}

/** Text the assistant takes out: blue with a line through it. */
function Del({ className, ...props }: ComponentProps<"del">) {
	return <del data-slot="del" className={cn(PROPOSAL_MARK_CLASSES.del, className)} {...props} />;
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
	return <div data-slot="current-proposal" className={cn(PROPOSAL_MARK_CLASSES.current, className)} {...props} />;
}

/**
 * The words a request to the assistant is attached to: a blue dotted underline and no background, so they never read as text the assistant put in. It
 * sets no color, so the text keeps its own.
 */
function RequestAnchor({ className, ...props }: ComponentProps<"span">) {
	return <span data-slot="request-anchor" className={cn(PROPOSAL_MARK_CLASSES.anchor, className)} {...props} />;
}

/**
 * A run of text on the highlight background: the words that differ between two versions (a changed source, two saved versions). It sets no color,
 * so the text keeps its own.
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

export { CurrentProposal, Del, Fill, Highlight, Ins, RequestAnchor };
