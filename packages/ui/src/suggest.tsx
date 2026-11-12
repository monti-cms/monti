import type { ComponentProps } from "react";
import { cn } from "./cn";
import { RecentlyViewed } from "./icons";
import { Spark } from "./spark";

/**
 * One row of the assistant's empty panel: a request to start from. `request` is one the screen offers (a spark), `recent` one asked before (a
 * clock): the mark tells them apart, so the rows have no group names. Pressing it sends the words. The rows stand in the `ChatThread`, at its foot.
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
				"flex min-h-monti-control-md w-full cursor-pointer items-center gap-monti-10 rounded-monti-full border-0 bg-transparent px-[14px] py-monti-6 text-left text-monti-body text-monti-default outline-none hover:bg-monti-selected focus-visible:ring-2 focus-visible:ring-monti-contrast/50 focus-visible:ring-inset [&>svg:first-child]:-ml-[2px] [&>svg]:shrink-0 [&>svg]:text-monti-subtle",
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

export { Suggest };
