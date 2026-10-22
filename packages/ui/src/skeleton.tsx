import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

/** A loading placeholder in the shape of what will appear: a line of text, a control, a block, an icon button or an avatar. */
const skeletonVariants = cva("animate-pulse bg-monti-neutral", {
	variants: {
		shape: {
			line: "h-4 rounded-sm",
			title: "h-6 rounded-sm",
			control: "h-control rounded-md",
			"control-sm": "h-control-sm rounded-md",
			block: "h-24 rounded-lg",
			icon: "size-control-sm rounded-md",
			avatar: "size-control rounded-full",
		},
		width: { full: "w-full", half: "w-1/2", third: "w-1/3", quarter: "w-1/4", "panel-sm": "w-panel-sm" },
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
