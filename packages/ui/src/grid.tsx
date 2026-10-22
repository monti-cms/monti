import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import type { BoxTag } from "./box";
import { cn } from "./cn";
import { type LayoutProps, layoutVariants, splitLayout } from "./layout";

/**
 * Children in equal columns, by count, stacked to one column on a narrow screen (`responsive`, the default). `sidebar` is a fixed side column
 * (the panel width) next to a fluid one. The gap takes the spacing names, as in `Stack`.
 */
const gridVariants = cva("grid", {
	variants: {
		columns: {
			1: "grid-cols-1",
			2: "grid-cols-2",
			3: "grid-cols-3",
			4: "grid-cols-4",
			sidebar: "grid-cols-[var(--container-panel)_minmax(0,1fr)]",
		},
		responsive: { true: "max-md:grid-cols-1" },
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
		align: { start: "items-start", center: "items-center", end: "items-end", stretch: "items-stretch" },
	},
	defaultVariants: { columns: 2, responsive: true, gap: "normal" },
});

function Grid({
	as: Tag = "div",
	columns,
	responsive,
	gap,
	align,
	className,
	...props
}: React.HTMLAttributes<HTMLElement> & VariantProps<typeof gridVariants> & LayoutProps & { as?: BoxTag }) {
	const [layout, rest] = splitLayout(props);
	return (
		<Tag
			className={cn(gridVariants({ columns, responsive, gap, align }), layoutVariants(layout), className)}
			{...rest}
		/>
	);
}

export { Grid };
