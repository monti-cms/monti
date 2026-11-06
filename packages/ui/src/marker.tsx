import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./cn";
import { Chat } from "./icons";

/** The dimmed look of text that is not decided yet: the source text a new translation starts from. It reads as a placeholder, and it is not published. */
const UNTRANSLATED = "text-monti-faint";

/**
 * Text, or a whole block, in the dimmed look of a translation that is not made yet. Typing in it, or choosing what to do with the block (translate,
 * keep the source, remove), takes the look away.
 */
function Untranslated({ className, ...props }: ComponentProps<"span">) {
	return <span data-slot="untranslated" className={cn(UNTRANSLATED, className)} {...props} />;
}

const markerVariants = cva(
	"inline-flex h-[18px] items-center gap-monti-2 whitespace-nowrap rounded-monti-full border-0 font-mono text-[10px] leading-none",
	{
		variants: {
			/**
			 * `request` is a note left for the assistant (a count); `changed`, `removed` and `added` a translated block whose source changed, is gone or is
			 * new since (warning, danger and success, the colors the changes lists use for the same words); `keep` a block that stays in the source language.
			 */
			tone: {
				request: "bg-monti-muted pr-[5px] pl-monti-4 text-monti-subtle",
				changed: "bg-monti-warning-muted px-monti-6 text-monti-warning",
				removed: "bg-monti-danger-muted px-monti-6 text-monti-danger",
				added: "bg-monti-success-muted px-monti-6 text-monti-success",
				keep: "px-monti-6 text-monti-subtle ring-1 ring-monti-default ring-inset",
			},
			/** Its card is open. */
			active: { true: "" },
			/**
			 * It hangs in the left margin of the block it belongs to (the block is `relative`): 12px from it, or with `proposal` 20px, clear of the blue line
			 * the block of the proposal being looked at has 18px out (`CurrentProposal`).
			 */
			margin: {
				true: "absolute top-monti-6 right-[calc(100%+12px)]",
				proposal: "absolute top-[7px] right-[calc(100%+20px)]",
			},
		},
		compoundVariants: [
			{ tone: "request", active: true, className: "bg-monti-emphasis text-monti-on-emphasis" },
			{ tone: "changed", active: true, className: "bg-(--monti-fg-warning) text-(color:--monti-bg-page)" },
			{ tone: "removed", active: true, className: "bg-(--monti-fg-danger) text-(color:--monti-bg-page)" },
			{ tone: "added", active: true, className: "bg-(--monti-fg-success) text-(color:--monti-bg-page)" },
		],
		defaultVariants: { tone: "request" },
	},
);

/**
 * A small tag in the left margin of a block, 18px tall in mono 10px (the one text smaller than the micro role). `request` carries a count (or "…" while the assistant works) and opens the note's card; `changed`,
 * `removed` and `added` say a translated block's source changed ("Changed"), is gone ("Removed") or is new ("New"); `keep` says the block stays in the source language. Press it to open what it is about
 * (give it `onClick`). The words are the app's.
 */
function Marker({
	tone,
	active,
	margin,
	className,
	children,
	...props
}: Omit<ComponentProps<"button">, "type"> & VariantProps<typeof markerVariants>) {
	const content = (
		<>
			{tone === "request" || tone === undefined || tone === null ? <Chat aria-hidden className="size-3" /> : null}
			{children}
		</>
	);
	// Without a press handler it is a label, not a button.
	if (!props.onClick) {
		return (
			<span
				data-slot="marker"
				data-tone={tone ?? "request"}
				className={cn(markerVariants({ tone, active, margin }), className)}
			>
				{content}
			</span>
		);
	}
	return (
		<button
			data-slot="marker"
			data-tone={tone ?? "request"}
			type="button"
			aria-pressed={active ?? undefined}
			className={cn(markerVariants({ tone, active, margin }), "cursor-pointer", className)}
			{...props}
		>
			{content}
		</button>
	);
}

export { Marker, Untranslated };
