"use client";

import type { ComponentProps } from "react";
import { cn } from "./cn";

/**
 * The editor's docked toolbar (2026-11 editor mockup `editor-docked.html`): a 40px row under the editor's head, on the page ground with a line and a faint
 * second line under it. Its buttons are the floating bar's (`FloatingBarButton`, `FormatButton`: 28px, `radius-md`), 2px apart in groups
 * (`EditorToolbarGroup`) split by short lines (`EditorToolbarSeparator`). It starts 6px before the text column (`width-reading`, centered), so the
 * first icon's ink stands on the column's edge; on a window too narrow for that, 12px from the edge. Name it with `aria-label`.
 */
function EditorToolbar({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="editor-toolbar"
			data-shape="square"
			role="toolbar"
			className={cn(
				"relative z-3 flex h-10 min-w-0 shrink-0 items-center gap-monti-2 whitespace-nowrap border-monti-default border-b bg-monti-page px-[max(12px,calc(50%-var(--monti-width-reading)/2-6px))] shadow-[0_1px_0_var(--monti-border-muted)]",
				className,
			)}
			{...props}
		/>
	);
}

/** Buttons of one kind in the toolbar (undo and redo, the inline formats, the lists), 2px apart. */
function EditorToolbarGroup({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="editor-toolbar-group"
			role="group"
			className={cn("flex items-center gap-monti-2", className)}
			{...props}
		/>
	);
}

/** The short line between two groups: 1px by 16px, 6px of room each side. */
function EditorToolbarSeparator({ className, ...props }: Omit<ComponentProps<"span">, "children">) {
	return (
		<span
			data-slot="editor-toolbar-separator"
			aria-hidden
			className={cn("mx-monti-6 h-4 w-px shrink-0 bg-(--monti-border-default)", className)}
			{...props}
		/>
	);
}

export { EditorToolbar, EditorToolbarGroup, EditorToolbarSeparator };
