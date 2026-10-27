"use client";

import type * as React from "react";
import { cn } from "./cn";

const SIZE = {
	micro: "text-monti-micro",
	label: "text-monti-label",
	caption: "text-monti-caption",
	body: "text-monti-body",
} as const;

/** A form label. `size` and `tone` by role (`micro` is the mono 11 label above a field); `hidden` keeps it for screen readers only. */
function Label({
	className,
	size = "label",
	tone = "default",
	hidden = false,
	...props
}: React.ComponentProps<"label"> & {
	size?: keyof typeof SIZE;
	tone?: "default" | "muted" | "subtle";
	hidden?: boolean;
}) {
	return (
		<label
			data-slot="label"
			className={cn(
				"flex select-none items-center gap-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
				SIZE[size],
				tone === "muted" && "text-monti-muted",
				tone === "subtle" && "text-monti-subtle",
				hidden && "sr-only",
				className,
			)}
			{...props}
		/>
	);
}

export { Label };
