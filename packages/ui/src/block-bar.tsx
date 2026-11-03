"use client";

import type { ComponentProps } from "react";
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
				"absolute -bottom-[5px] size-[11px] rounded-monti-sm border border-monti-strong bg-monti-page p-0 outline-none focus-visible:ring-2 focus-visible:ring-monti-contrast/20",
				side === "left" ? "-left-[5px] cursor-nesw-resize" : "-right-[5px] cursor-nwse-resize",
				className,
			)}
			{...props}
		/>
	);
}

export { ResizeCorner };
