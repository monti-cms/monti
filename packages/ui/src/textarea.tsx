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
				"field-sizing-content flex min-h-16 w-full rounded-md border border-monti-default bg-transparent px-2.5 py-2 outline-none transition-[color,box-shadow] placeholder:text-monti-muted focus-visible:border-monti-focus focus-visible:ring-3 focus-visible:ring-monti-focus-soft disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-monti-danger aria-invalid:ring-3 aria-invalid:ring-monti-danger-soft",
				size === "sm" ? "text-monti-label" : "text-monti-reading md:text-monti-body",
				mono && "font-mono",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
