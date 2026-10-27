import type * as React from "react";
import { cn } from "./cn";

function Textarea({
	className,
	size = "default",
	mono = false,
	...props
}: React.ComponentProps<"textarea"> & {
	/** `sm` writes at the label size, for compact panels; `default` at the reading size on a phone and body size above. */
	size?: "sm" | "default";
	/** Fixed-width letters for code and source text. */
	mono?: boolean;
}) {
	return (
		<textarea
			data-slot="textarea"
			data-size={size}
			className={cn(
				"field-sizing-content flex min-h-16 w-full rounded-monti-md border border-monti-default bg-monti-page px-2.5 py-2 outline-none transition-[color,border-color,box-shadow] placeholder:text-monti-subtle hover:border-monti-emphasis focus-visible:border-monti-contrast focus-visible:ring-3 focus-visible:ring-monti-contrast/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-monti-danger aria-invalid:ring-3 aria-invalid:ring-monti-danger/20",
				size === "sm" ? "text-monti-label" : "text-monti-reading md:text-monti-body",
				mono && "font-mono",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
