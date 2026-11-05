"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Something the editor floats at a point of the screen it measured: the block handle in a block's margin, the format bar over selected words. The
 * point is in viewport pixels; `place` says which corner or edge of the thing sits on it: `start` its top left, `above` the middle of its bottom edge.
 * It draws no surface of its own; what it holds does (`BlockHandle`, `FloatingBar`).
 */
function EditorOverlay({
	top,
	left,
	place = "start",
	children,
}: {
	top: number;
	left: number;
	place?: "start" | "above";
	children: ReactNode;
}) {
	if (typeof document === "undefined") return null;
	return createPortal(
		<div
			data-slot="editor-overlay"
			className="fixed z-40 flex items-center data-[place=above]:-translate-x-1/2 data-[place=above]:-translate-y-full"
			data-place={place}
			style={{ top, left }}
		>
			{children}
		</div>,
		document.body,
	);
}

export { EditorOverlay };
