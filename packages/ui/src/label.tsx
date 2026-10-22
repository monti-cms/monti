"use client";

import type * as React from "react";
import { cn } from "./cn";

const SIZE = { label: "text-monti-label", caption: "text-monti-caption", body: "text-monti-body" } as const;

/** A form label. `size` and `tone` by role; `hidden` keeps it for screen readers only. */
function Label({
	className,
	size = "label",
	tone = "default",
	hidden = false,
	...props
}: React.ComponentProps<"label"> & { size?: keyof typeof SIZE; tone?: "default" | "muted"; hidden?: boolean }) {
	return (
		<label
			data-slot="label"
			className={cn(
				"flex select-none items-center gap-2 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
				SIZE[size],
				tone === "muted" && "text-monti-muted",
				hidden && "sr-only",
				className,
			)}
			{...props}
		/>
	);
}

export { Label };
