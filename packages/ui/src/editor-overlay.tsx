"use client";

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { cn } from "./cn";
import { CutWords } from "./cut-words";
import { HELD } from "./sortable";

/** How far left of the text a mark in the margin stands (px), and the least it comes to where the margin is narrow. */
const MARGIN_GAP = 32;
const MARGIN_GAP_LEAST = 4;

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
	const box = useRef<HTMLDivElement>(null);
	const [gap, setGap] = useState(MARGIN_GAP);
	// Where the margin is narrow (the assistant's panel open beside the editor) the gap to the text shrinks, down to 4px, so the mark stays inside
	// the margin and is not cut at the column's edge (AS-13).
	useLayoutEffect(() => {
		const mark = box.current;
		const body = mark?.offsetParent;
		if (!mark || !(body instanceof HTMLElement)) return;
		const measure = () => {
			let edge = 0;
			for (let at = body.parentElement; at; at = at.parentElement)
				if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(at).overflowX)) {
					edge = at.getBoundingClientRect().left;
					break;
				}
			const room = body.getBoundingClientRect().left - edge - beside - mark.offsetWidth;
			setGap(Math.max(MARGIN_GAP_LEAST, Math.min(MARGIN_GAP, Math.floor(room))));
		};
		measure();
		const watch = new ResizeObserver(measure);
		watch.observe(body);
		watch.observe(mark);
		return () => watch.disconnect();
	}, [beside]);
	return (
		<div
			ref={box}
			data-slot="editor-margin"
			className="absolute flex items-center gap-monti-4"
			// design-allow: the block's top, the mark beside it and the gap the margin leaves, measured in the editor
			style={{ top, right: `calc(100% + ${gap}px)`, marginRight: beside }}
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
			<span className="shrink-0 text-monti-caption text-monti-subtle">{kind}</span>
			{text ? <CutWords className="min-w-0 truncate">{text}</CutWords> : null}
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

export { DropLine, EditorMargin, EditorMarginLine, HeldBlock };
