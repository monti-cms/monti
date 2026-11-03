import type { ComponentProps } from "react";
import { cn } from "./cn";
import { RecentlyViewed } from "./icons";
import { Spark } from "./spark";

/**
 * One row of the assistant's empty panel: a request to start from. `request` is a saved one (a spark), `recent` one asked before (a clock). Pressing it
 * sends the words, or puts them in the box.
 */
function Suggest({
	kind,
	className,
	children,
	...props
}: Omit<ComponentProps<"button">, "type"> & { kind: "request" | "recent" }) {
	return (
		<button
			data-slot="suggest"
			data-kind={kind}
			type="button"
			className={cn(
				"flex w-full cursor-pointer items-center gap-monti-10 rounded-monti-lg border-0 bg-transparent px-monti-12 py-[7px] text-left text-monti-body text-monti-default outline-none hover:bg-monti-selected focus-visible:ring-2 focus-visible:ring-monti-contrast/20 [&>svg]:shrink-0 [&>svg]:text-monti-subtle",
				className,
			)}
			{...props}
		>
			{kind === "request" ? (
				<Spark className="size-monti-icon-sm" />
			) : (
				<RecentlyViewed aria-hidden className="size-3.5" />
			)}
			{children}
		</button>
	);
}

/**
 * The assistant's empty panel: the requests to start from, in groups under a {@link SuggestLabel}, sitting at the bottom of the panel just over the box
 * to type in. It fills the panel's height and scrolls when the rows do not fit.
 */
function SuggestList({ className, children, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="suggest-list"
			className={cn("flex min-h-0 flex-1 flex-col-reverse overflow-auto", className)}
			{...props}
		>
			<div className="flex flex-col gap-monti-2 px-monti-12 pt-monti-12 pb-monti-4">{children}</div>
		</div>
	);
}

/** The name of a group of {@link Suggest} rows ("In this list", "Recent"): mono 11 in the subtle gray, lined up with the rows' words. */
function SuggestLabel({ className, ...props }: ComponentProps<"span">) {
	return (
		<span
			data-slot="suggest-label"
			className={cn("px-monti-12 pt-monti-12 pb-monti-6 text-monti-micro text-monti-subtle first:pt-0", className)}
			{...props}
		/>
	);
}

export { Suggest, SuggestLabel, SuggestList };
