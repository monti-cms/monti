"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";
import { EditorBody } from "./editor-body";
import { HELD } from "./sortable";

/**
 * Something the editor floats at a point of the screen it measured: the block handle in a block's margin, the format bar over selected words. The
 * point is in viewport pixels; `place` says which corner or edge of the thing sits on it: `start` its top left, `above` the middle of its bottom edge.
 * It draws no surface of its own; what it holds does (`BlockHandle`, `FloatingBar`).
 */
function EditorOverlay({
	top,
	left,
	width,
	place = "start",
	children,
}: {
	top: number;
	left: number;
	/** As wide as what it stands for (a held block, a drop line). */
	width?: number;
	place?: "start" | "above";
	children: ReactNode;
}) {
	if (typeof document === "undefined") return null;
	return createPortal(
		<div
			data-slot="editor-overlay"
			className="pointer-events-auto fixed z-40 flex items-center data-[place=above]:-translate-x-1/2 data-[place=above]:-translate-y-full"
			data-place={place}
			style={{ top, left, width }}
		>
			{children}
		</div>,
		document.body,
	);
}

/**
 * A block of the text in hand while it is dragged: the same lifted look as every dragged thing (`HELD`: the page ground and the floating shadow), with
 * the block's own text in the body's looks. The editor holds it just under the pointer, so it never covers the line where it lands or the block
 * above that line. `html` is the block as the editor drew it; it is a picture, never edited.
 */
function HeldBlock({ html }: { html: string }) {
	return (
		<div data-slot="held-block" className={cn(HELD, "pointer-events-none w-full rounded-monti-md px-monti-8")}>
			<EditorBody
				className="py-monti-4 [&>*]:my-0 [&_h2]:mt-0 [&_h3]:mt-0 [&_h4]:mt-0 [&_ol]:mb-0 [&_p]:mb-0 [&_ul]:mb-0"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: the editor's own drawing of a block, copied to show it in hand
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		</div>
	);
}

/** Where a dragged block lands: a 2px ink line between two blocks, as wide as the block it lands beside. */
function DropLine() {
	return (
		<div
			data-slot="drop-line"
			aria-hidden
			className="pointer-events-none h-0.5 w-full rounded-monti-full bg-monti-emphasis"
		/>
	);
}

export { DropLine, EditorOverlay, HeldBlock };
