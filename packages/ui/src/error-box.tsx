import type * as React from "react";
import { cn } from "./cn";

/**
 * Why something could not be shown, in its place (a diagram or a formula that does not parse, a preview that failed to load): the message as it is, in
 * small mono letters in the danger ink, on the danger ground inside a faint danger edge.
 */
function ErrorBox({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="error-box"
			role="alert"
			className={cn(
				"whitespace-pre-wrap break-words rounded-monti-md border border-monti-danger/40 bg-monti-danger-muted p-monti-12 font-mono text-monti-caption text-monti-danger",
				className,
			)}
			{...props}
		/>
	);
}

export { ErrorBox };
