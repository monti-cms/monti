import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

/** A loading placeholder in the shape of what will appear: a line of text, a control, a block, an icon button or an avatar. */
const skeletonVariants = cva("animate-pulse bg-monti-muted", {
	variants: {
		shape: {
			line: "h-4 rounded-monti-sm",
			title: "h-6 rounded-monti-sm",
			/** The large title at the top of a document (the editor's title line). */
			heading: "h-9 rounded-monti-md",
			control: "h-monti-icon-button rounded-monti-md",
			"control-sm": "h-monti-control-sm rounded-monti-md",
			block: "h-24 rounded-monti-lg",
			icon: "size-monti-control-sm rounded-monti-md",
			avatar: "size-monti-icon-button rounded-monti-full",
		},
		/** Fractions follow the box; `chip`, `short` and `medium` are fixed, for a tab, a button or a short label. */
		width: {
			full: "w-full",
			"three-quarters": "w-3/4",
			half: "w-1/2",
			third: "w-1/3",
			quarter: "w-1/4",
			chip: "w-14",
			short: "w-20",
			medium: "w-32",
			"panel-sm": "w-monti-menu",
		},
	},
	compoundVariants: [{ shape: ["icon", "avatar"], class: "shrink-0" }],
	defaultVariants: { shape: "line", width: "full" },
});

function Skeleton({
	className,
	shape,
	width,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof skeletonVariants>) {
	const sized = shape === "icon" || shape === "avatar";
	return (
		<div
			data-slot="skeleton"
			className={cn(skeletonVariants({ shape, width: sized ? null : width }), className)}
			{...props}
		/>
	);
}

export { Skeleton };
