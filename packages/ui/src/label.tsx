"use client";

import type * as React from "react";
import { cn } from "./cn";

const SIZE = {
	micro: "text-monti-micro",
	label: "text-monti-label",
	caption: "text-monti-caption",
	body: "text-monti-body",
} as const;

/**
 * A form label, by default the design system's: mono 11 in the subtle ink (`micro` and `subtle`), the label above a field. `size` and `tone` pick another
 * role for a label that reads as text (a checkbox's); `hidden` keeps it for screen readers only. `required` ends the label with a red `*` 2px after the
 * text, for a form that also has optional fields (a form whose every field is required, and a select that always holds a value, get no mark). The star
 * is decorative: the control itself carries `required`, so a screen reader does not depend on it.
 */
function Label({
	className,
	size = "micro",
	tone = "subtle",
	hidden = false,
	required = false,
	children,
	...props
}: React.ComponentProps<"label"> & {
	size?: keyof typeof SIZE;
	tone?: "default" | "muted" | "subtle";
	hidden?: boolean;
	/** The field must be filled in: shows the red star. Put the real `required` on the control too. */
	required?: boolean;
}) {
	return (
		<label
			data-slot="label"
			className={cn(
				"flex select-none items-center gap-monti-8 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
				SIZE[size],
				tone === "default" && "text-monti-default",
				tone === "muted" && "text-monti-muted",
				tone === "subtle" && "text-monti-subtle",
				hidden && "sr-only",
				className,
			)}
			{...props}
		>
			{required ? (
				<span>
					{children}
					<span aria-hidden="true" className="ml-[2px] text-monti-danger">
						*
					</span>
				</span>
			) : (
				children
			)}
		</label>
	);
}

export { Label };
