"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";
import { HELD } from "./sortable";

/**
 * Something the editor floats at a point of the screen it measured: the block handle in a block's margin, the format bar over selected words. The
 * point is in viewport pixels; `place` says which corner or edge of the thing sits on it: `start` its top left, `above` the middle of its bottom edge,
 * `center` its middle (a table's grip on the table's edge). It draws no surface of its own; what it holds does (`BlockHandle`, `FloatingBar`).
 */
function EditorOverlay({
	top,
	left,
	width,
	height,
	place = "start",
	children,
}: {
	top: number;
	left: number;
	/** As wide as what it stands for (a held block, a drop line, a table's edge). */
	width?: number;
	/** As tall as what it stands for (a table's right edge). */
	height?: number;
	place?: "start" | "above" | "center";
	children: ReactNode;
}) {
	if (typeof document === "undefined") return null;
	return createPortal(
		<div
			data-slot="editor-overlay"
			className="pointer-events-auto fixed z-40 flex items-center data-[place=above]:-translate-x-1/2 data-[place=center]:-translate-x-1/2 data-[place=above]:-translate-y-full data-[place=center]:-translate-y-1/2"
			data-place={place}
			style={{ top, left, width, height }}
		>
			{children}
		</div>,
		document.body,
	);
}

/**
 * Something hung in the text's left margin, level with a block: a translation's marks ("Changed", "New", "Source"). It sits in `EditorBody`, `top`
 * px below the body's top (the block's own top, measured), its right edge 32px left of the text: outside the block handle (the 24px grip 4px off the
 * text) with 4px between, so the handle a pointer on the block shows never covers a mark it is going to press. It scrolls with the text. It draws no
 * surface of its own; what it holds does (`Marker`).
 */
function EditorMargin({
	top,
	beside = 0,
	children,
}: {
	top: number;
	/** How far left of its place it stands, in px: the width of another mark hung at the same block (measured), so the two do not overlap. */
	beside?: number;
	children: ReactNode;
}) {
	return (
		<div
			data-slot="editor-margin"
			className="absolute right-[calc(100%+32px)] flex items-center gap-monti-4"
			// design-allow: the block's top and the mark beside it, measured in the editor
			style={{ top, marginRight: beside }}
		>
			{children}
		</div>
	);
}

/** A line above the text with something hung in the same left margin as a block's marks: the title and the source's change to it (T111). */
function EditorMarginLine({ margin, children }: { margin?: ReactNode; children: ReactNode }) {
	return (
		<div data-slot="editor-margin-line" className="relative">
			{margin ? (
				<div
					data-slot="editor-margin"
					className="absolute top-1/2 right-[calc(100%+32px)] flex -translate-y-1/2 items-center"
				>
					{margin}
				</div>
			) : null}
			{children}
		</div>
	);
}

/**
 * A block of the text in hand while it is dragged: a small card (at most 280px wide) with the block's kind and the start of its text, beside the
 * pointer, never the block at full width over the text it is moving through. Its surface is the lifted look of every dragged thing (`HELD`: the page
 * ground and the floating shadow). The block itself stays in place, dimmed (`EditorBody`'s `data-held`).
 */
function HeldBlock({ kind, text }: { kind: string; text: string }) {
	return (
		<div
			data-slot="held-block"
			className={cn(
				HELD,
				"pointer-events-none flex max-w-[280px] items-baseline gap-monti-8 rounded-monti-md px-monti-12 py-monti-6 text-monti-body",
			)}
		>
			<span className="shrink-0 text-monti-meta text-monti-subtle">{kind}</span>
			{text ? <span className="min-w-0 truncate">{text}</span> : null}
		</div>
	);
}

/**
 * Where a dragged block lands: a 2px ink line in the middle of the gap between two blocks, as wide as the block it lands beside, with an 8px ring
 * at its start that sticks out 4px to the left, so the line reads as a place, not a rule of the text.
 */
function DropLine() {
	return (
		<div
			data-slot="drop-line"
			aria-hidden
			className="pointer-events-none relative h-0.5 w-full bg-monti-emphasis before:absolute before:top-1/2 before:left-0 before:size-2 before:-translate-y-1/2 before:rounded-monti-full before:border-2 before:border-monti-contrast before:bg-monti-page before:content-['']"
		/>
	);
}

export { DropLine, EditorMargin, EditorMarginLine, EditorOverlay, HeldBlock };
