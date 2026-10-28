import type * as React from "react";
import { cn } from "./cn";

/**
 * Text shown as it is: fixed-width, line breaks kept, in the design system's inner box (`bg-muted`, `radius-lg`, no border): a JSON value, an error's details,
 * a model's answer. Long lines wrap unless `wrap={false}`; it scrolls past `maxHeight`. The design system has no code block of its own, so it is drawn
 * like its nearest part, the inner box.
 */
function CodeBlock({
	className,
	wrap = true,
	maxHeight = "list",
	size = "caption",
	...props
}: React.ComponentProps<"pre"> & { wrap?: boolean; maxHeight?: "list" | "half" | "none"; size?: "caption" | "note" }) {
	return (
		<pre
			data-slot="code-block"
			className={cn(
				"overflow-auto rounded-monti-lg bg-monti-muted p-monti-12 font-mono",
				size === "caption" ? "text-monti-caption" : "text-monti-note",
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
