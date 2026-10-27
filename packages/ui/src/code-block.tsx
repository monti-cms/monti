import type * as React from "react";
import { cn } from "./cn";

/**
 * Text shown as it is: fixed-width, line breaks kept, on the inset surface (a JSON value, an error's details, a model's answer). Long lines
 * wrap unless `wrap={false}`; it scrolls past `maxHeight`.
 */
function CodeBlock({
	className,
	wrap = true,
	maxHeight = "list",
	size = "caption",
	...props
}: React.ComponentProps<"pre"> & { wrap?: boolean; maxHeight?: "list" | "half" | "none"; size?: "caption" | "label" }) {
	return (
		<pre
			data-slot="code-block"
			className={cn(
				"overflow-auto rounded-monti-md border border-monti-muted bg-monti-tool p-monti-12 font-mono",
				size === "caption" ? "text-monti-caption" : "text-monti-label",
				wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
				maxHeight === "list" && "max-h-96",
				maxHeight === "half" && "max-h-[50vh]",
				className,
			)}
			{...props}
		/>
	);
}

export { CodeBlock };
