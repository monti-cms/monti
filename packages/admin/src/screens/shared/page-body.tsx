import type { ComponentProps } from "react";
import { cn } from "../../lib/utils/cn";
import { PAGE_MAX_WIDTH } from "./layout";

/**
 * The body of a settings or tools page: left-aligned under the page header, one maximum width and one padding, so no page can drift from the others.
 * Cards inside it take the full width; their texts keep a readable measure on their own. A form-like page keeps the readable width; a `wide` page
 * (a workspace of lists, trees and side panels) uses all the width there is, with the same padding.
 */
export function PageBody({ className, wide, ...props }: ComponentProps<"div"> & { wide?: boolean }) {
	return (
		<div
			className={cn(
				"flex w-full flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8",
				wide ? "max-w-none" : PAGE_MAX_WIDTH,
				className,
			)}
			{...props}
		/>
	);
}
