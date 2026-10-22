import { cn, Stack } from "@monti-cms/ui/internal";
import type { ComponentProps } from "react";
import { PAGE_MAX_WIDTH } from "./layout";

/**
 * The body of a settings or tools page: left-aligned under the page header, one maximum width and one padding, so no page can drift from the others.
 * Cards inside it take the full width; their texts keep a readable measure on their own. A form-like page keeps the readable width; a `wide` page
 * (a workspace of lists, trees and side panels) uses all the width there is, with the same padding.
 */
export function PageBody({ className, wide, ...props }: ComponentProps<"div"> & { wide?: boolean }) {
	return (
		<Stack
			gap="spacious"
			width="full"
			// design-system: needs a page-width option on Stack (the form-like page's 1160px maximum) and responsive page padding
			className={cn(
				"px-comfortable py-spacious lg:px-wide lg:py-wide",
				wide ? "max-w-none" : PAGE_MAX_WIDTH,
				className,
			)}
			{...props}
		/>
	);
}
