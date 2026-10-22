"use client";

import { cn } from "@monti-cms/ui";
import type { ReactNode, Ref } from "react";
import { ACTIVE_BLOCK_STYLE } from "./source-sync";

/** The scrolling area that holds the editor. With a translation source the block matching the source's is highlighted. */
export function EditorScroller({
	scrollerRef,
	highlightActive,
	inert,
	children,
}: {
	scrollerRef: Ref<HTMLDivElement>;
	highlightActive: boolean;
	inert: boolean;
	children: ReactNode;
}) {
	return (
		<div
			ref={scrollerRef}
			// Keep the source pane and bottom padding equal so correspondence holds even when scrolled to the end.
			className={cn("h-full min-w-0 flex-1 overflow-y-auto", highlightActive && ACTIVE_BLOCK_STYLE)}
			inert={inert}
		>
			{children}
		</div>
	);
}
