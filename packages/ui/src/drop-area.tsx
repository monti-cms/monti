import type * as React from "react";
import { cn } from "./cn";

/**
 * Wraps what files can be dropped on (the folder tiles and the file grid). While files are dragged over it (`over`), it does not hide anything: a
 * 1.5px ink line runs along its edge and a 7% ink tint is multiplied over the whole area (screened in the dark theme). The tint darkens the page, the
 * folder tiles and the previews by the same amount, so their usual differences stay. It keeps what it holds 12px in from that line and stands 12px clear of
 * what is above it, so the line touches neither; `flush` is for what brings its own room (a table). Folder tiles are not recolored: a folder the files
 * are over takes `FolderTile dropTarget` instead, and the area's frame goes out. The hint "Drop here" is `toast.dropHint`.
 */
function DropArea({
	over = false,
	fill = false,
	flush = false,
	className,
	children,
	...props
}: React.ComponentProps<"div"> & {
	/** Files are being dragged over the area, and not over a folder in it. */
	over?: boolean;
	/** It takes the rest of its column, so a page with few files can be dropped on all the way down. */
	fill?: boolean;
	/** What it holds brings its own room: the area adds none. */
	flush?: boolean;
}) {
	return (
		<div
			data-slot="drop-area"
			data-over={over || undefined}
			className={cn("relative", !flush && "mt-monti-12 p-monti-12", fill && "flex-1", className)}
			{...props}
		>
			{children}
			{over && (
				<span
					aria-hidden
					data-slot="drop-area-overlay"
					className="pointer-events-none absolute inset-0 z-1 rounded-monti-lg bg-[color-mix(in_srgb,var(--monti-fg-default)_7%,var(--monti-bg-page))] mix-blend-multiply monti-dark:mix-blend-screen ring-[1.5px] ring-monti-contrast ring-inset"
				/>
			)}
		</div>
	);
}

export { DropArea };
