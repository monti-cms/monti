import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

/** A loading placeholder in the shape of what will appear: a line of text, a control, a block, an icon button or an avatar. */
const skeletonVariants = cva("animate-pulse bg-monti-neutral", {
	variants: {
		shape: {
			line: "h-4 rounded-sm",
			title: "h-6 rounded-sm",
			/** The large title at the top of a document (the editor's title line). */
			heading: "h-9 rounded-md",
			control: "h-control rounded-md",
			"control-sm": "h-control-sm rounded-md",
			block: "h-24 rounded-lg",
			icon: "size-control-sm rounded-md",
			avatar: "size-control rounded-full",
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
			"panel-sm": "w-panel-sm",
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
