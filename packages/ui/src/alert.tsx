import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "./cn";

/**
 * Notice for the admin UI. `tone` says what it means: `neutral` for information, `danger` for errors such as a load failure, `warning` and `success`
 * for the states between, `accent` for a pointer to the next step. `layout` says where it sits: a box in the content (`grid`, `stack`, `inline`), or
 * a `strip` across the top of a pane, flush with what is below it. The look of body blocks (callouts, etc.) is decided by each block separately.
 */
export const alertVariants = cva(
	["relative w-full border text-monti-body", "[&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current"].join(" "),
	{
		variants: {
			layout: {
				grid: "grid grid-cols-[calc(var(--spacing)*4)_1fr] items-start gap-x-3 gap-y-1 rounded-monti-lg px-4 py-3",
				stack: "block rounded-monti-lg px-4 py-3",
				/** A one-line notice with its action on the right (a load failure with "Retry"). */
				inline: "flex items-center justify-between gap-3 rounded-monti-lg px-4 py-3",
				/** Across the top of a pane, under its tabs: no radius, a line below only, the page's side padding. */
				strip: "flex items-center justify-between gap-3 border-x-0 border-t-0 px-8 py-2 text-monti-label",
			},
			tone: {
				neutral: "border-monti-muted bg-monti-page text-monti-default",
				accent: "border-monti-emphasis bg-monti-selected text-monti-default",
				danger: "border-monti-danger/40 bg-monti-danger-muted text-monti-danger",
				warning: "border-monti-warning/40 bg-monti-warning-muted text-monti-warning",
				success: "border-monti-success/40 bg-monti-success-muted text-monti-success",
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
		<div data-slot="alert-title" className={cn("col-start-2 line-clamp-1 min-h-4 font-medium", className)} {...props} />
	);
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-description"
			className={cn("col-start-2 grid justify-items-start gap-1 text-monti-body text-monti-muted", className)}
			{...props}
		/>
	);
}

export { Alert, AlertTitle, AlertDescription };
