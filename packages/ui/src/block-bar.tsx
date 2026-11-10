"use client";

import type { ComponentProps, ReactNode, Ref } from "react";
import { cn } from "./cn";

/** A corner of a block, by the compass. */
type BlockCorner = "nw" | "ne" | "sw" | "se";

/**
 * A square handle on a corner of a selected block (an image); dragging it changes the block's width. Each of the four corners has one, so the nearest
 * is at hand from wherever the pointer comes (2026-11-10, owner). The parent is `relative`; the handle sits half outside its corner. The editor reads the
 * drag from the pointer events. The top two answer the pointer only: the bottom two take the keyboard, so a screen reader hears each side once.
 */
function ResizeCorner({
	corner,
	label,
	className,
	...props
}: Omit<ComponentProps<"button">, "aria-label" | "children"> & {
	corner: BlockCorner;
	label: string;
}) {
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

/**
 * The box of a block with a size of its own (an image): its corners and tool row hang off it. With no `width` it fills the column. `selected` draws a 2px ink
 * line around it, as a picked file block's border, so a picked picture reads as picked (2026-11-10, owner).
 */
function BlockBox({
	width,
	selected = false,
	ref,
	children,
}: {
	width?: number | null;
	selected?: boolean;
	ref?: Ref<HTMLDivElement>;
	children: ReactNode;
}) {
	return (
		<div
			ref={ref}
			data-slot="block-box"
			data-selected={selected || undefined}
			className="relative w-full"
			style={width ? { width, maxWidth: "100%" } : undefined}
		>
			{children}
			{selected && (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 rounded-monti-md outline-2 outline-monti-contrast outline-offset-0"
				/>
			)}
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

export { BlockBarPlace, BlockBox, type BlockCorner, ResizeCorner };
