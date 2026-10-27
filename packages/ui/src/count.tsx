import type * as React from "react";
import { cn } from "./cn";

/**
 * A number or short measure in mono, next to a name (148 posts, 3 changed, 64%). No pill and no box: the warning tone marks something that
 * needs attention, the danger tone something that failed.
 */
function Count({
	tone = "default",
	className,
	...props
}: React.ComponentProps<"span"> & { tone?: "default" | "warning" | "danger" }) {
	return (
		<span
			data-slot="count"
			className={cn(
				"font-mono text-monti-meta",
				tone === "default" && "text-monti-subtle",
				tone === "warning" && "text-monti-warning",
				tone === "danger" && "text-monti-danger",
				className,
			)}
			{...props}
		/>
	);
}

export { Count };
