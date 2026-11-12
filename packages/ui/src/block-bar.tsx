"use client";

import type { ComponentProps, ReactNode, Ref } from "react";
import { cn } from "./cn";

/** A corner of a block, by the compass. */
type BlockCorner = "nw" | "ne" | "sw" | "se";

/**
 * A square handle on a corner of a selected block (an image); dragging it changes the block's width. Each of the four corners has one, so the nearest
 * is at hand from wherever the pointer comes (2026-11-10, owner). The parent is `relative`; the handle sits half outside its corner. The editor reads the
 * drag from the pointer events. The top two answer the pointer only, with no name: the bottom two take the keyboard, so a screen reader hears each side once.
 */
function ResizeCorner({
	corner,
	label,
	className,
	...props
}: Omit<ComponentProps<"button">, "aria-label" | "children"> &
	({ corner: "nw" | "ne"; label?: never } | { corner: "sw" | "se"; label: string })) {
	const top = corner === "nw" || corner === "ne";
	return (
		<button
			data-slot="resize-corner"
			data-corner={corner}
			type="button"
			aria-label={top ? undefined : label}
			aria-hidden={top || undefined}
			tabIndex={top ? -1 : undefined}
			className={cn(
				"absolute z-1 size-[11px] rounded-monti-sm border border-monti-strong bg-monti-page p-0 outline-none focus-visible:ring-2 focus-visible:ring-monti-contrast/50",
				top ? "-top-[5px]" : "-bottom-[5px]",
				corner === "nw" || corner === "sw" ? "-left-[5px]" : "-right-[5px]",
				corner === "nw" || corner === "se" ? "cursor-nwse-resize" : "cursor-nesw-resize",
				className,
			)}
			{...props}
		/>
	);
}

/** A block's width: in px, or a share of the column. */
type BlockWidth = `${number}px` | `${number}%`;

/**
 * The box of a block with a size of its own (an image): its corners and tool row hang off it. `width` is its width in px or a share of the column, as the
 * site draws it, and a narrower column shrinks it; with none it fills the column. `selected` draws a 2px ink line around it, as a picked file block's
 * border, so a picked picture reads as picked. Where the keyboard stops at the box itself (`tabIndex`, in a body that cannot be written in), holding the
 * keyboard's focus draws the ordinary focus ring (2px, ink 50%) around it, on the same layer: where the keyboard is and what is picked are two states,
 * and a picked box that holds the focus shows the line. `measure` is what a corner being dragged makes of it ("420 × 280", "62%"), shown at its top right; `spoken`
 * is what a screen reader hears of its size as it changes by keys or by pointer, read from a region that is always there so the first change is heard too.
 */
function BlockBox({
	width,
	selected = false,
	measure,
	spoken,
	ref,
	children,
	...props
}: {
	width?: BlockWidth;
	selected?: boolean;
	measure?: string;
	spoken?: string;
	ref?: Ref<HTMLDivElement>;
	children: ReactNode;
} & Omit<ComponentProps<"div">, "children" | "className" | "style" | "ref">) {
	return (
		<div
			ref={ref}
			data-slot="block-box"
			data-selected={selected || undefined}
			className="group/block-box relative w-full max-w-full outline-none"
			// design-allow: the block's own width, chosen by the person or the picture's own.
			style={width ? { width } : undefined}
			{...props}
		>
			{children}
			<span aria-live="polite" className="sr-only">
				{spoken}
			</span>
			{measure && (
				<span
					aria-hidden="true"
					className="pointer-events-none absolute top-monti-8 right-monti-8 z-1 rounded-monti-md bg-monti-emphasis px-monti-8 py-monti-4 font-mono text-monti-caption text-monti-on-emphasis"
				>
					{measure}
				</span>
			)}
			<div
				aria-hidden="true"
				data-slot="block-line"
				className="pointer-events-none absolute inset-0 hidden rounded-monti-md outline-offset-0 group-focus-visible/block-box:block group-focus-visible/block-box:ring-2 group-focus-visible/block-box:ring-monti-contrast/50 group-data-selected/block-box:block group-data-selected/block-box:outline-2 group-data-selected/block-box:outline-monti-contrast"
			/>
		</div>
	);
}

/**
 * Where a selected block's tool row stands: over the block's top left, outside it, where it covers no text. Its parent is the block's picture box (position relative).
 */
function BlockBarPlace({ children }: { children: ReactNode }) {
	return (
		<div data-slot="block-bar-place" contentEditable={false} className="absolute bottom-full left-0 z-1 mb-monti-8">
			{children}
		</div>
	);
}

export { BlockBarPlace, BlockBox, type BlockCorner, type BlockWidth, ResizeCorner };
