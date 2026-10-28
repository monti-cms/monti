import { Folder } from "@carbon/icons-react";
import type * as React from "react";
import { Checkbox } from "./checkbox";
import { cn } from "./cn";
import { Count } from "./count";
import { TextButton } from "./text-button";

/**
 * A file in a grid (the media library, an image to insert): a 4:3 preview, the name over a mono detail line. Flat: no card, no border.
 *
 * - Picked: a 2px ink ring around the preview and the check on. The check shows in the preview's top left when the pointer is on the tile, and
 *   on every tile (faint) while any are picked (`picking`). `action` is the ⋯ at the top right, shown with the pointer.
 * - `status="uploading"`: the preview is faded and a 3px bar runs along its bottom edge while `progress` (0–100) is known. The detail line says how
 *   far ("Uploading · 64%"). The name is quiet.
 * - `status="failed"`: a 1px red ring drawn over the preview's edge, the detail line is red and the name is quiet; `actions` are what can be done ("Shrink and retry",
 *   "Remove"). A failed file stays in its place.
 * - `proposal`: the assistant's suggestion for this file, in the place of the detail line, in the proposal-mark look. A picked tile that has one
 *   is ringed and checked in blue.
 */
function Tile({
	preview,
	title,
	detail,
	selected = false,
	picking = false,
	onSelectedChange,
	selectLabel,
	status = "ready",
	progress,
	proposal,
	actions,
	action,
	dimmed = false,
	className,
	...props
}: Omit<React.ComponentProps<"button">, "title"> & {
	preview: React.ReactNode;
	title: React.ReactNode;
	/** The mono line under the name: size, usage, a path. */
	detail?: React.ReactNode;
	selected?: boolean;
	/** Some tile of the grid is picked: show this tile's check, faint. */
	picking?: boolean;
	/** Adds the check; called with the new state. */
	onSelectedChange?: (selected: boolean) => void;
	/** The name of the check, for screen readers. */
	selectLabel?: string;
	status?: "ready" | "uploading" | "failed";
	/** How far an upload is, 0–100. */
	progress?: number;
	/** The suggestion sentence. */
	proposal?: React.ReactNode;
	/** For a failed tile: what can be done, as text buttons under the name. `primary` is set in ink. */
	actions?: readonly { label: string; onClick: () => void; primary?: boolean }[];
	/** The ⋯ at the top right (a button that opens the tile's menu). */
	action?: React.ReactNode;
	dimmed?: boolean;
}) {
	const failed = status === "failed";
	const uploading = status === "uploading";
	return (
		<div
			data-slot="tile"
			data-selected={selected || undefined}
			data-status={status}
			className={cn("group/tile relative flex min-w-0 flex-col gap-monti-8", dimmed && "opacity-50", className)}
		>
			<button
				type="button"
				aria-pressed={selected}
				className="flex min-w-0 flex-col gap-monti-8 border-0 bg-transparent p-0 text-left outline-none focus-visible:*:first:ring-3 focus-visible:*:first:ring-monti-contrast/20"
				{...props}
			>
				<span
					className={cn(
						"relative block aspect-[4/3] overflow-hidden rounded-monti-md bg-monti-muted",
						selected && (proposal ? "ring-2 ring-monti-proposal" : "ring-2 ring-monti-contrast"),
					)}
				>
					<span className={cn("block size-full", uploading && "opacity-45")}>{preview}</span>
					{failed && (
						// Above the picture: a ring on the box itself would be painted under it.
						<span
							aria-hidden
							data-slot="tile-failed-ring"
							className="pointer-events-none absolute inset-0 rounded-monti-md ring-1 ring-monti-danger ring-inset"
						/>
					)}
					{uploading && progress !== undefined && (
						<span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-monti-muted">
							<span className="block h-full bg-monti-emphasis" style={{ width: `${progress}%` }} />
						</span>
					)}
				</span>
				<span className="flex min-w-0 flex-col gap-monti-2">
					<span className={cn("truncate text-monti-body", (uploading || failed) && "text-monti-subtle")}>{title}</span>
					{proposal ? (
						<span className="truncate text-monti-body">
							<span className="rounded-monti-sm bg-monti-proposal-muted px-[2px] py-px text-monti-proposal">
								{proposal}
							</span>
						</span>
					) : (
						detail && (
							<span
								className={cn("truncate font-mono text-monti-meta text-monti-subtle", failed && "text-monti-danger")}
							>
								{detail}
							</span>
						)
					)}
				</span>
			</button>
			{onSelectedChange && (
				<span
					className={cn(
						"absolute top-monti-8 left-monti-8 flex pointer-coarse:opacity-100 focus-within:opacity-100",
						selected
							? "opacity-100"
							: picking
								? "opacity-60 group-hover/tile:opacity-100 group-data-hovered/tile:opacity-100"
								: "opacity-0 group-hover/tile:opacity-100 group-data-hovered/tile:opacity-100",
					)}
				>
					<Checkbox
						checked={selected}
						onCheckedChange={(next) => onSelectedChange(next === true)}
						aria-label={selectLabel}
						proposal={Boolean(proposal)}
						className="bg-monti-page"
					/>
				</span>
			)}
			{action && (
				<span className="absolute top-monti-6 right-monti-8 flex rounded-monti-full bg-monti-page opacity-0 pointer-coarse:opacity-100 focus-within:opacity-100 group-hover/tile:opacity-100 has-aria-expanded:opacity-100 group-data-hovered/tile:opacity-100">
					{action}
				</span>
			)}
			{failed && actions && actions.length > 0 && (
				<span className="flex gap-monti-12 text-monti-note">
					{actions.map((item) => (
						<TextButton
							key={item.label}
							onClick={item.onClick}
							className={item.primary ? "text-monti-default" : undefined}
						>
							{item.label}
						</TextButton>
					))}
				</span>
			)}
		</div>
	);
}

/**
 * A folder in the grid, beside the files: a low tile with the folder's icon, its name and how many it holds. `selected` is the folder a menu
 * is open on. While files are dragged over it, `dropTarget` takes the selected background and a 1.5px ink ring. With `children` (a
 * {@link RenameField}) they take the place of the name and the count, for a new folder or a rename. `action` is the ⋯ at the right, the
 * grid's rule for tiles: shown with the pointer (always on touch), and it takes the place of the count while shown.
 */
function FolderTile({
	icon = <Folder aria-hidden />,
	name,
	count,
	selected = false,
	dropTarget = false,
	action,
	className,
	children,
	...props
}: Omit<React.ComponentProps<"button">, "children" | "name"> & {
	/** Defaults to the folder icon; "up one level" brings its own. */
	icon?: React.ReactNode;
	name?: React.ReactNode;
	count?: number;
	selected?: boolean;
	/** Files are being dragged over this folder. */
	dropTarget?: boolean;
	/** The ⋯ at the right (a button that opens the folder's menu). Not with `children`. */
	action?: React.ReactNode;
	/** In place of the name and count. */
	children?: React.ReactNode;
}) {
	const body = (
		<>
			<span className="flex shrink-0 text-monti-subtle [&_svg]:size-4">{icon}</span>
			{children ?? (
				<>
					<span className="min-w-0 grow truncate text-left">{name}</span>
					{count !== undefined && (
						<Count
							className={cn(
								"ml-auto shrink-0",
								action &&
									"pointer-coarse:opacity-0 group-focus-within/folder:opacity-0 group-hover/folder:opacity-0 group-has-aria-expanded/folder:opacity-0",
							)}
						>
							{count}
						</Count>
					)}
				</>
			)}
		</>
	);
	const look = cn(
		"flex h-13 w-full min-w-0 items-center gap-[10px] rounded-monti-md border-0 bg-monti-muted px-[14px] text-monti-body text-monti-default outline-none focus-visible:ring-3 focus-visible:ring-monti-contrast/20",
		selected && "bg-monti-selected",
		dropTarget && "bg-monti-selected ring-[1.5px] ring-monti-contrast ring-inset",
		className,
	);
	return children ? (
		<div data-slot="folder-tile" data-drop-target={dropTarget || undefined} className={look}>
			{body}
		</div>
	) : (
		<div className="group/folder relative min-w-0">
			<button
				type="button"
				data-slot="folder-tile"
				data-drop-target={dropTarget || undefined}
				className={cn(look, "cursor-pointer", action && "pr-[44px]")}
				{...props}
			>
				{body}
			</button>
			{action && (
				<span
					className={cn(
						"absolute top-1/2 right-monti-8 flex -translate-y-1/2 rounded-monti-full opacity-0 pointer-coarse:opacity-100 focus-within:opacity-100 group-hover/folder:opacity-100 has-aria-expanded:opacity-100",
						dropTarget || selected ? "bg-monti-selected" : "bg-monti-muted",
					)}
				>
					{action}
				</span>
			)}
		</div>
	);
}

export { FolderTile, Tile };
