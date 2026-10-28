import { RecentlyViewed } from "@carbon/icons-react";
import type { ComponentProps } from "react";
import { cn } from "./cn";
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

export { Suggest };
