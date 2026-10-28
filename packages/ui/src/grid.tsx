import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import type { BoxTag } from "./box";
import { cn } from "./cn";
import { type LayoutProps, layoutVariants, splitLayout } from "./layout";
import { GAP } from "./tokens.generated";

/**
 * Children in equal columns, by count, stacked to one column on a narrow screen (`responsive`, the default). `sidebar` is a fixed side column
 * (the panel width) next to a fluid one. `tiles` is the design system's tile grid (`.mt-tiles`): columns of at least 180px (four in an 880px column, more in a wider one), 24px between rows and 20px between columns
 * (two columns on a narrow screen). Every other gap takes the spacing steps, as in `Stack`.
 */
const gridVariants = cva("grid", {
	variants: {
		columns: {
			1: "grid-cols-1",
			2: "grid-cols-2",
			3: "grid-cols-3",
			4: "grid-cols-4",
			6: "grid-cols-6",
			sidebar: "grid-cols-[var(--monti-width-panel)_minmax(0,1fr)]",
			/**
			 * A label column next to the content: the admin's own settings section (`screens/shared/section.tsx`), 220px, or 260px wide. These two widths are not
			 * the design system's; its settings section is `Section`, a title column that wraps (`flex: 1 1 180px`), which that screen part moves to with the settings screens.
			 */
			rail: "grid-cols-[220px_minmax(0,1fr)]",
			"rail-wide": "grid-cols-[260px_minmax(0,1fr)]",
			/** Equal columns of at least 180px: a grid of tiles (files, images, folders), four across in an 880px column and more in a wider one. */
			tiles: "grid-cols-[repeat(auto-fill,minmax(180px,1fr))]",
		},
		responsive: { true: "max-md:grid-cols-1" },
		gap: GAP,

		align: { start: "items-start", center: "items-center", end: "items-end", stretch: "items-stretch" },
	},
	// Tiles keep the design system's own gaps, whatever `gap` says; on a narrow screen they are two across.
	compoundVariants: [
		{ columns: "tiles", class: "gap-x-monti-20 gap-y-monti-24" },
		{ columns: "tiles", responsive: true, class: "max-md:grid-cols-2" },
	],
	defaultVariants: { columns: 2, responsive: true, gap: 12 },
});

function Grid({
	as: Tag = "div",
	columns,
	responsive,
	gap,
	align,
	className,
	...props
}: React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> } & VariantProps<typeof gridVariants> &
	LayoutProps & { as?: BoxTag }) {
	const [layout, rest] = splitLayout(props);
	const Element = Tag as React.ElementType;
	return (
		<Element
			className={cn(gridVariants({ columns, responsive, gap, align }), layoutVariants(layout), className)}
			{...rest}
		/>
	);
}

export { Grid };
