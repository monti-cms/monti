import type { ComponentProps } from "react";
import { cn } from "../../lib/utils/cn";

/**
 * The body of every Settings tab: left-aligned under the page header, one maximum width and one padding, so no tab can drift from the others.
 * Cards inside it take the full width; their texts keep a readable measure on their own.
 */
export function PageBody({ className, ...props }: ComponentProps<"div">) {
	return (
		<div className={cn("flex w-full max-w-[1160px] flex-col gap-6 px-4 py-6 lg:px-10 lg:py-8", className)} {...props} />
	);
}
