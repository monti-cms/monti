import { cva, type VariantProps } from "class-variance-authority";
import { MessageSquare } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "./cn";

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
	"inline-flex h-[18px] items-center gap-monti-2 whitespace-nowrap rounded-monti-full border-0 font-mono text-monti-micro leading-none",
	{
		variants: {
			/**
			 * `request` is a note left for the assistant (a count), `changed` a block whose source changed since it was translated (changed, new, removed),
			 * `keep` a block that stays in the source language.
			 */
			tone: {
				request: "bg-monti-muted pr-[5px] pl-monti-4 text-monti-subtle",
				changed: "bg-monti-warning-muted px-monti-6 text-monti-warning",
				keep: "px-monti-6 text-monti-subtle ring-1 ring-monti-default ring-inset",
			},
			/** Its card is open. */
			active: { true: "" },
			/** It hangs in the left margin of the block it belongs to, 12px from it (the block is `relative`). */
			margin: { true: "absolute top-monti-6 right-[calc(100%+12px)]" },
		},
		compoundVariants: [
			{ tone: "request", active: true, className: "bg-monti-emphasis text-monti-on-emphasis" },
			{ tone: "changed", active: true, className: "bg-(--monti-fg-warning) text-(color:--monti-bg-page)" },
		],
		defaultVariants: { tone: "request" },
	},
);

/**
 * A small tag in the left margin of a block. `request` carries a count (or "…" while the assistant works) and opens the note's card; `changed` says a
 * translated block's source changed ("Changed", "New", "Removed"); `keep` says the block stays in the source language. Press it to open what it is about
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
			{tone === "changed" || tone === "keep" ? null : (
				<MessageSquare aria-hidden className="size-3" strokeWidth={1.4} />
			)}
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
