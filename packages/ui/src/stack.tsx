import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import type { BoxTag } from "./box";
import { cn } from "./cn";
import { type LayoutProps, layoutVariants, splitLayout } from "./layout";
import { GAP } from "./tokens.generated";

/**
 * Lays out its children in a column or a row. The gap is a step of the design system's spacing scale in px (`gap={8}`: 0 2 4 6 8 10 12 16 20 24 32 40 48),
 * 12 by default.
 */
export const stackVariants = cva("flex", {
	variants: {
		direction: { column: "flex-col", row: "flex-row" },
		gap: GAP,

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
	defaultVariants: { direction: "column", gap: 12 },
});

type StackProps = React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> } & VariantProps<
		typeof stackVariants
	> &
	LayoutProps & { as?: BoxTag };

function Stack({ as: Tag = "div", direction, gap, align, justify, wrap, className, ...props }: StackProps) {
	const [layout, rest] = splitLayout(props);
	const Element = Tag as React.ElementType;
	return (
		<Element
			className={cn(stackVariants({ direction, gap, align, justify, wrap }), layoutVariants(layout), className)}
			{...rest}
		/>
	);
}

/** Children side by side: a `Stack` in a row, centered on the cross axis by default (an icon and its label, a toolbar). */
function Inline({ align = "center", ...props }: Omit<StackProps, "direction">) {
	return <Stack direction="row" align={align} {...props} />;
}

export { Inline, Stack };
export type { StackProps };
