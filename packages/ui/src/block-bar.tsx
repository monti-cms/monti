"use client";

import type { ComponentProps, ReactNode, Ref } from "react";
import { cn } from "./cn";

/**
 * A square handle on a bottom corner of a selected block (an image); dragging it changes the block's width. The parent is `relative`; the handle
 * sits half outside its corner. The editor reads the drag from the pointer events.
 */
function ResizeCorner({
	side,
	label,
	className,
	...props
}: Omit<ComponentProps<"button">, "aria-label" | "children"> & {
	side: "left" | "right";
	label: string;
}) {
	return (
		<button
			data-slot="resize-corner"
			type="button"
			aria-label={label}
			className={cn(
				"absolute -bottom-[5px] size-[11px] rounded-monti-sm border border-monti-strong bg-monti-page p-0 outline-none focus-visible:ring-2 focus-visible:ring-monti-contrast/50",
				side === "left" ? "-left-[5px] cursor-nesw-resize" : "-right-[5px] cursor-nwse-resize",
				className,
			)}
			{...props}
		/>
	);
}

/** The box of a block with a size of its own (an image): its corners and tool row hang off it. With no `width` it fills the column. */
function BlockBox({ width, ref, children }: { width?: number | null; ref?: Ref<HTMLDivElement>; children: ReactNode }) {
	return (
		<div
			ref={ref}
			data-slot="block-box"
			className="relative w-full"
			style={width ? { width, maxWidth: "100%" } : undefined}
		>
			{children}
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

export { BlockBarPlace, BlockBox, ResizeCorner };
