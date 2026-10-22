import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "./cn";

/**
 * Lays out its children in a column or a row with a gap picked by name, from the spacing tokens (`--spacing-*` in styles/theme.css):
 * tight 4px (an icon and its label), condensed 8px (controls in a toolbar), normal 12px (rows of a form), comfortable 16px (groups in a card),
 * spacious 24px (groups on a page), wide 32px (page padding), section 48px (sections of a page).
 */
export const stackVariants = cva("flex", {
	variants: {
		direction: { column: "flex-col", row: "flex-row" },
		gap: {
			none: "gap-0",
			tight: "gap-tight",
			condensed: "gap-condensed",
			normal: "gap-normal",
			comfortable: "gap-comfortable",
			spacious: "gap-spacious",
			wide: "gap-wide",
			section: "gap-section",
		},
		align: {
			start: "items-start",
			center: "items-center",
			end: "items-end",
			baseline: "items-baseline",
			stretch: "items-stretch",
		},
		justify: { start: "justify-start", center: "justify-center", end: "justify-end", between: "justify-between" },
		wrap: { true: "flex-wrap" },
	},
	defaultVariants: { direction: "column", gap: "normal" },
});

function Stack({
	as: Tag = "div",
	direction,
	gap,
	align,
	justify,
	wrap,
	className,
	...props
}: React.HTMLAttributes<HTMLElement> &
	VariantProps<typeof stackVariants> & {
		as?: "div" | "section" | "ul" | "ol" | "li" | "header" | "footer" | "nav" | "form";
	}) {
	return <Tag className={cn(stackVariants({ direction, gap, align, justify, wrap }), className)} {...props} />;
}

export { Stack };
