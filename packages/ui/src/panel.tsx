import type * as React from "react";
import { cn } from "./cn";
import { type LayoutProps, layoutVariants, splitLayout } from "./layout";

/** A resting surface: a card with a hairline border. Takes the layout options (padding, overflow, size) of `Box`. */
function Panel({ className, ...props }: React.ComponentProps<"div"> & LayoutProps) {
	const [layout, rest] = splitLayout(props);
	return (
		<div
			data-slot="panel"
			className={cn(
				"rounded-monti-lg border border-monti-muted bg-monti-page text-monti-default",
				layoutVariants(layout),
				className,
			)}
			{...rest}
		/>
	);
}

export { Panel };
