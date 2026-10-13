import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * Alert box for the admin UI. `default` is for notices, `destructive` for errors such as a load failure, `warning` and `success` for the states between.
 * The look of body blocks (callouts, etc.) is decided by each block separately.
 */
export const alertVariants = cva(
	[
		"relative w-full rounded-lg border px-4 py-3 text-sm",
		"[&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
	].join(" "),
	{
		variants: {
			layout: {
				grid: "grid grid-cols-[calc(var(--spacing)*4)_1fr] gap-x-3 gap-y-1 items-start",
				stack: "block",
				/** A one-line notice with its action on the right (a load failure with "Retry"). */
				inline: "flex items-center justify-between gap-3",
			},
			variant: {
				default: "border-cms-border bg-cms-card text-cms-card-foreground",
				destructive:
					"border-cms-destructive/30 bg-cms-destructive-soft text-cms-destructive-foreground [&>svg]:text-current",
				warning: "border-cms-warning/30 bg-cms-warning-soft text-cms-warning-foreground [&>svg]:text-current",
				success: "border-cms-success/30 bg-cms-success-soft text-cms-success-foreground [&>svg]:text-current",
			},
		},
		defaultVariants: {
			layout: "grid",
			variant: "default",
		},
	},
);

function Alert({
	className,
	layout,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div data-slot="alert" role="alert" className={cn(alertVariants({ layout, variant }), className)} {...props} />
	);
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-title"
			className={cn("col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight", className)}
			{...props}
		/>
	);
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-description"
			className={cn(
				"col-start-2 grid justify-items-start gap-1 text-cms-muted-foreground text-sm [&_p]:leading-relaxed",
				className,
			)}
			{...props}
		/>
	);
}

export { Alert, AlertTitle, AlertDescription };
