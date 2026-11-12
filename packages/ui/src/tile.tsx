import type * as React from "react";
import { Checkbox } from "./checkbox";
import { cn } from "./cn";
import { Count } from "./count";
import { Folder } from "./icons";

/**
 * A file in a grid (the media library, an image to insert): a 4:3 preview, the name over a mono detail line. Flat: no card, no border.
 *
 * - Picked: a 2px ink ring around the preview and the check on. The file open in a panel (`current`) has the same ring without the check. The check shows in the preview's top left when the pointer is on the tile, and
 *   on every tile (faint) while any are picked (`picking`). `action` is the ⋯ at the top right, shown with the pointer.
 * - `status="uploading"`: the preview is faded and a 3px bar runs along its bottom edge while `progress` (0–100) is known. The detail line says how
 *   far ("Uploading · 64%"). The name is quiet.
 * - `status="failed"`: the network cut it off. Its picture stays, fainter than while it goes up, inside a 1px red ring; the detail line is red and the name is quiet. `retry` is the
 *   button over the middle of the picture: on the picture, so the tile is as tall as its neighbours. `action` is shown all the time, as what is left to do with it. Neither has a ground: the faint picture leaves them readable, on a dark photo too.
 * - `proposal`: the assistant's suggestion for this file, in the place of the detail line, in the proposal-mark look. A picked tile that has one
 *   is ringed and checked in blue; one whose card is open (`current`) is ringed in blue without the check.
 */
function Tile({
	preview,
	title,
	detail,
	selected = false,
	current = false,
	picking = false,
	onSelectedChange,
	selectLabel,
	status = "ready",
	progress,
	proposal,
	retry,
	action,
	dimmed = false,
	onKeyDown,
	className,
	...props
}: Omit<React.ComponentProps<"button">, "title" | "onKeyDown"> & {
	preview: React.ReactNode;
	title: React.ReactNode;
	/** The mono line under the name: size, usage, a path. */
	detail?: React.ReactNode;
	selected?: boolean;
	/** The file open in a panel beside the grid: the same ring as a picked tile, with no check. */
	current?: boolean;
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
	/** The button that tries again, shown over the middle of the picture (an `IconButton`). */
	retry?: React.ReactNode;
	/** The ⋯ at the top right (a button that opens the tile's menu), or what takes out a file that did not go up. */
	action?: React.ReactNode;
	dimmed?: boolean;
	/** A key pressed anywhere on the tile, on its check too. A menu it opens is drawn elsewhere, and its keys are the menu's. */
	onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
}) {
	const failed = status === "failed";
	const uploading = status === "uploading";
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: it only hears the keys that come up from the tile's own button and check
		<div
			data-slot="tile"
			data-selected={selected || undefined}
			data-status={status}
			className={cn("group/tile relative flex min-w-0 flex-col gap-monti-8", dimmed && "opacity-60", className)}
			onKeyDown={(event) => {
				if (event.currentTarget.contains(event.target as Node)) onKeyDown?.(event);
			}}
		>
			<button
				type="button"
				aria-pressed={selected}
				className={cn(
					"flex min-w-0 flex-col gap-monti-8 border-0 bg-transparent p-0 text-left outline-none focus-visible:*:first:ring-2",
					// A picked or open tile is ringed already, in ink or in a proposal's blue. Under the keyboard that ring steps 2px off the picture and
					// keeps its colour: the step is the focus, the same for every picked tile, and no state's colour is taken away.
					selected || current
						? "focus-visible:*:first:ring-offset-2 focus-visible:*:first:ring-offset-monti-page"
						: "focus-visible:*:first:ring-monti-contrast/50",
				)}
				{...props}
			>
				<span
					className={cn(
						"relative block aspect-[4/3] overflow-hidden rounded-monti-md bg-monti-muted",
						selected && (proposal ? "ring-2 ring-monti-proposal" : "ring-2 ring-monti-contrast"),
						current && !selected && (proposal ? "ring-2 ring-monti-proposal" : "ring-2 ring-monti-contrast"),
					)}
				>
					<span className={cn("block size-full", uploading && "opacity-45", failed && "opacity-30")}>{preview}</span>
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
								className={cn("truncate font-mono text-monti-meta", failed ? "text-monti-danger" : "text-monti-subtle")}
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
								? "in-data-popup-open:opacity-100 opacity-60 group-hover/tile:opacity-100 group-data-hovered/tile:opacity-100"
								: "in-data-popup-open:opacity-100 opacity-0 group-hover/tile:opacity-100 group-data-hovered/tile:opacity-100",
					)}
				>
					<Checkbox
						checked={selected}
						onCheckedChange={(next) => onSelectedChange(next === true)}
						aria-label={selectLabel}
						proposal={Boolean(proposal)}
						className="bg-monti-page hover:not-data-disabled:shadow-none"
					/>
				</span>
			)}
			{retry && (
				// As large as the preview, with no ground: only the button takes the pointer.
				<span className="pointer-events-none absolute inset-x-0 top-0 flex aspect-[4/3] items-center justify-center">
					<span className="pointer-events-auto flex">{retry}</span>
				</span>
			)}
			{action && (
				<span
					className={cn(
						"absolute top-monti-6 right-monti-8 flex",
						// Over a picture as it is, the ⋯ needs a ground to be seen.
						!failed &&
							"rounded-monti-full bg-monti-page in-data-popup-open:opacity-100 opacity-0 pointer-coarse:opacity-100 focus-within:opacity-100 group-hover/tile:opacity-100 has-aria-expanded:opacity-100 group-data-hovered/tile:opacity-100",
					)}
				>
					{action}
				</span>
			)}
		</div>
	);
}

/**
 * A folder in the grid, beside the files: a low tile with the folder's icon, its name and how many it holds. `selected` is the folder a menu
 * is open on (it also takes that ground while a right-click menu opened on its cell is open). While files are dragged over it, `dropTarget` takes the selected background and a 1.5px ink ring. With `children` (a
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
									"in-data-popup-open:opacity-0 pointer-coarse:opacity-0 group-focus-within/folder:opacity-0 group-hover/folder:opacity-0 group-has-aria-expanded/folder:opacity-0",
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
		"flex h-13 w-full min-w-0 items-center gap-monti-10 rounded-monti-md border-0 bg-monti-muted px-[14px] text-monti-body text-monti-default outline-none focus-visible:ring-2 focus-visible:ring-monti-contrast/50 in-data-popup-open:bg-monti-selected",
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
						"absolute top-1/2 right-monti-8 flex -translate-y-1/2 rounded-monti-full in-data-popup-open:opacity-100 opacity-0 pointer-coarse:opacity-100 focus-within:opacity-100 group-hover/folder:opacity-100 has-aria-expanded:opacity-100",
						dropTarget || selected ? "bg-monti-selected" : "bg-monti-muted in-data-popup-open:bg-monti-selected",
					)}
				>
					{action}
				</span>
			)}
		</div>
	);
}

export { FolderTile, Tile };
