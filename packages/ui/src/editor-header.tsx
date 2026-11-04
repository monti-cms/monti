import type * as React from "react";
import { cn } from "./cn";

/**
 * The head of an editor: the way back, where the entry lives and its state at the start; saving, publishing and the editor's tools at the end. As tall as
 * the sidebar's head, on the page ground with a line under it; on a narrow screen its two ends wrap.
 */
function EditorHeader({ className, ...props }: React.ComponentProps<"header">) {
	return (
		<header
			data-slot="editor-header"
			className={cn(
				"flex min-h-monti-header shrink-0 flex-wrap items-center justify-between gap-monti-12 border-monti-default border-b bg-monti-page px-monti-12",
				className,
			)}
			{...props}
		/>
	);
}

/** The ink rule under an entry's title, 20px below it, that sets the title apart from the body. */
function EditorTitleRule({ className, ...props }: Omit<React.ComponentProps<"div">, "children">) {
	return (
		<div
			data-slot="editor-title-rule"
			aria-hidden="true"
			className={cn("border-monti-contrast border-b pt-monti-20", className)}
			{...props}
		/>
	);
}

export { EditorHeader, EditorTitleRule };
