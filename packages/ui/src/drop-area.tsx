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

/**
 * An empty folder as the place to drop files (the media library, 2026-11 redesign `media-empty.html`): a 520px frame with a 1.5px dashed line
 * (`border-emphasis`, `radius-lg`), 16px under the head row, and in its middle a 40px box with `icon` (the upload arrow), the `title` in 14px 600, one
 * faint `hint` line (what can go in, the size limit), and the `actions` (`Button size="sm"`, square in the frame), 6px apart.
 */
function DropEmpty({
	icon,
	title,
	hint,
	actions,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "title"> & {
	icon: React.ReactNode;
	title: React.ReactNode;
	hint?: React.ReactNode;
	actions?: React.ReactNode;
}) {
	return (
		<div
			data-slot="drop-empty"
			data-shape="square"
			className={cn(
				"mt-monti-16 flex h-[520px] shrink-0 flex-col items-center justify-center gap-monti-8 rounded-monti-lg border-[1.5px] border-monti-emphasis border-dashed text-center",
				className,
			)}
			{...props}
		>
			<span className="flex size-10 items-center justify-center rounded-monti-lg border border-monti-default bg-monti-tool text-monti-faint [&_svg]:size-4">
				{icon}
			</span>
			<p className="m-0 mt-monti-4 font-semibold text-monti-body text-monti-default">{title}</p>
			{hint && <p className="m-0 text-monti-faint text-monti-note leading-4">{hint}</p>}
			{actions && <div className="mt-monti-8 flex gap-monti-6">{actions}</div>}
		</div>
	);
}

export { DropArea, DropEmpty };
