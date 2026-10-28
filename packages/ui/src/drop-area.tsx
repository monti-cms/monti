import type * as React from "react";
import { cn } from "./cn";

/**
 * Wraps what files can be dropped on (the folder tiles and the file grid). While files are dragged over it (`over`), it does not hide anything: a
 * 1.5px ink line runs around the grid, 12px outside it, and a 7% ink tint is multiplied over the whole area (screened in the dark theme). The
 * tint darkens the page, the folder tiles and the previews by the same amount, so their usual differences stay. Folder tiles are not
 * recolored: a folder the files are over takes `FolderTile dropTarget` instead, and the area's frame goes out. The hint "Drop here" is
 * `toast.dropHint`.
 */
function DropArea({
	over = false,
	className,
	children,
	...props
}: React.ComponentProps<"div"> & {
	/** Files are being dragged over the area, and not over a folder in it. */
	over?: boolean;
}) {
	return (
		<div data-slot="drop-area" data-over={over || undefined} className={cn("relative", className)} {...props}>
			{children}
			{over && (
				<span
					aria-hidden
					data-slot="drop-area-overlay"
					className="pointer-events-none absolute inset-x-0 top-monti-12 -bottom-monti-12 z-1 rounded-monti-lg bg-[color-mix(in_srgb,var(--monti-fg-default)_7%,white)] monti-dark:bg-[color-mix(in_srgb,var(--monti-fg-default)_7%,black)] mix-blend-multiply monti-dark:mix-blend-screen ring-[1.5px] ring-monti-contrast ring-inset"
				/>
			)}
		</div>
	);
}

export { DropArea };
