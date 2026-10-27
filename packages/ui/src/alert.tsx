import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "./cn";

/**
 * Notice for the admin UI. `tone` says what it means: `neutral` for information, `danger` for errors such as a load failure, `warning` and `success`
 * for the states between. `layout` says how it is arranged inside its box in the content (`grid`, `stack`, `inline`). A notice across the top of a pane
 * is a `Banner`. The look of body blocks (callouts, etc.) is decided by each block separately.
 */
export const alertVariants = cva(
	["relative w-full text-monti-body", "[&>svg]:size-4 [&>svg]:translate-y-[2px] [&>svg]:text-current"].join(" "),
	{
		variants: {
			layout: {
				grid: "grid grid-cols-[16px_1fr] items-start gap-x-monti-12 gap-y-monti-4 rounded-monti-lg px-monti-16 py-monti-12",
				stack: "block rounded-monti-lg px-monti-16 py-monti-12",
				/** A one-line notice with its action on the right (a load failure with "Retry"). */
				inline: "flex items-center justify-between gap-monti-12 rounded-monti-lg px-monti-16 py-monti-12",
			},
			tone: {
				neutral: "border-monti-muted bg-monti-tool text-monti-default",
				danger: "border-monti-danger/30 bg-monti-danger-muted text-monti-danger",
				warning: "border-monti-warning/30 bg-monti-warning-muted text-monti-warning",
				success: "border-monti-success/30 bg-monti-success-muted text-monti-success",
			},
		},
		defaultVariants: {
			layout: "grid",
			tone: "neutral",
		},
	},
);

function Alert({
	className,
	layout,
	tone,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return <div data-slot="alert" role="alert" className={cn(alertVariants({ layout, tone }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-title"
			className={cn("col-start-2 line-clamp-1 min-h-4 text-monti-label", className)}
			{...props}
		/>
	);
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-description"
			className={cn("col-start-2 grid justify-items-start gap-monti-4 text-monti-body text-monti-muted", className)}
			{...props}
		/>
	);
}

export { Alert, AlertTitle, AlertDescription };
