"use client";

import type * as React from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { Count } from "./count";
import { DIALOG_ACTIONS, Dialog, DialogClose, DialogContent, DialogTitle } from "./dialog";
import { Upload } from "./icons";
import { Input } from "./input";
import { useUiLabels } from "./labels";
import { folderTree, SUB_LINE } from "./sidebar";

/** One place in the folder list of the picker. `depth` 0 is a folder at the top, 1 one inside it. */
interface MediaPickerFolder {
	id: string;
	name: string;
	depth: number;
	/** How many files it holds; left out where the number would not match what the picker shows. */
	count?: number;
}

/**
 * The library as a picker (images to insert, a cover image, files to attach): a 760px modal with the folders at the left, a search box and the files as
 * three columns of tiles at the right, "Upload" at the bottom left, and Cancel and the one pill at the bottom right. Choosing and then pressing the
 * pill puts the file in at once; there is no step after it. Until a file is picked the pill is not there (`confirmHidden`). The tiles are `children` (a `Tile` each, `FilePreview` for a file). The folder list is
 * `folders` under the top entry `allLabel`; `folder` is the picked one, `null` for all.
 */
function MediaPicker({
	open,
	onOpenChange,
	title,
	allLabel,
	folders,
	folder,
	onFolderChange,
	foldersLabel,
	search,
	onSearchChange,
	searchLabel,
	uploadLabel,
	onUpload,
	uploadDisabled,
	confirmLabel,
	onConfirm,
	confirmHidden,
	notice,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	/** The top entry of the folder list: everything, whatever folder it is in. */
	allLabel: string;
	folders: readonly MediaPickerFolder[];
	folder: string | null;
	onFolderChange: (id: string | null) => void;
	/** The name of the folder list, for screen readers. */
	foldersLabel: string;
	search: string;
	onSearchChange: (search: string) => void;
	/** The name and the placeholder of the search box. */
	searchLabel: string;
	uploadLabel: string;
	/** Opens the place where a file is chosen to upload. */
	onUpload: () => void;
	uploadDisabled?: boolean;
	confirmLabel: string;
	onConfirm: () => void;
	/** Nothing is picked yet: the pill is not there until a file is (a greyed pill would say nothing about why). */
	confirmHidden?: boolean;
	/** Shown in place of the tiles when there is something to say instead (the list could not be loaded, nothing is there). */
	notice?: React.ReactNode;
	children?: React.ReactNode;
}) {
	const labels = useUiLabels();
	const tree = folderTree(folders.map((item) => Math.min(item.depth ?? 0, PICK_DEPTH.length - 1)));
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-monti-20 pb-monti-20 sm:max-w-[760px]">
				<DialogTitle>{title}</DialogTitle>
				{/* One height, whatever a folder holds: both columns scroll inside it. */}
				<div className="grid h-[min(27rem,60vh)] grid-cols-[168px_minmax(0,1fr)] gap-monti-20">
					{/* 4px of room around the rows so a focus ring is not cut by the scrolling area. */}
					<nav
						aria-label={foldersLabel}
						className="-m-monti-4 flex min-h-0 flex-col gap-monti-2 overflow-y-auto p-monti-4"
					>
						<PickerFolder label={allLabel} on={folder === null} onClick={() => onFolderChange(null)} />
						{folders.map((item, index) => (
							<PickerFolder
								key={item.id}
								label={item.name}
								count={item.count}
								depth={item.depth}
								tree={tree[index]}
								on={folder === item.id}
								onClick={() => onFolderChange(item.id)}
							/>
						))}
					</nav>
					<div className="flex min-h-0 min-w-0 flex-col gap-monti-12">
						<Input
							aria-label={searchLabel}
							placeholder={searchLabel}
							value={search}
							onChange={(event) => onSearchChange(event.target.value)}
						/>
						{/* 4px of room around the tiles so the ring of a picked one is not cut by the scrolling area. */}
						<div className="-m-monti-4 grid min-h-0 flex-1 grid-cols-3 content-start gap-x-monti-12 gap-y-monti-16 overflow-y-auto p-monti-4">
							{notice ? <div className="col-span-3">{notice}</div> : children}
						</div>
					</div>
				</div>
				<div className={cn(DIALOG_ACTIONS, "mt-monti-4")}>
					<Button type="button" variant="ghost" className="mr-auto" disabled={uploadDisabled} onClick={onUpload}>
						<Upload aria-hidden />
						{uploadLabel}
					</Button>
					<DialogClose render={<Button variant="ghost" />}>{labels.cancel}</DialogClose>
					{confirmHidden ? null : (
						<Button type="button" onClick={onConfirm}>
							{confirmLabel}
						</Button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

/** Where a folder row's words start and its rule runs, by depth: as in the sidebar's tree, under "all images" as its parent, in the window's narrower column. */
const PICK_DEPTH = ["pl-[28px]", "pl-[44px]", "pl-[60px]", "pl-[76px]"] as const;
const PICK_LINE_X = ["before:left-[14px]", "before:left-[30px]", "before:left-[46px]", "before:left-[62px]"] as const;
const PICK_LINE_LEFT = [14, 30, 46, 62] as const;

function PickerFolder({
	label,
	count,
	depth,
	tree,
	on,
	onClick,
}: {
	label: string;
	count?: number;
	/** With a depth the row stands in the tree under "all images"; without one it is that row. */
	depth?: number;
	tree?: ReturnType<typeof folderTree>[number];
	on: boolean;
	onClick: () => void;
}) {
	const level = Math.min(depth ?? 0, PICK_DEPTH.length - 1) as 0 | 1 | 2 | 3;
	const through = (tree?.through ?? []).flatMap((running, at) => (running ? [PICK_LINE_LEFT[at]] : []));
	return (
		<button
			type="button"
			aria-current={on ? "true" : undefined}
			onClick={onClick}
			className={cn(
				"flex h-monti-control-md w-full min-w-0 shrink-0 cursor-pointer items-center gap-monti-10 rounded-monti-md border-0 bg-transparent px-monti-10 text-left text-monti-body outline-none hover:bg-monti-selected focus-visible:ring-2 focus-visible:ring-monti-contrast/50",
				on ? "bg-monti-current font-semibold text-monti-default" : "text-monti-muted",
				tree && cn(SUB_LINE, PICK_DEPTH[level], PICK_LINE_X[level]),
				tree?.last && "before:bottom-monti-4",
			)}
		>
			{through.map((left) => (
				<span
					key={left}
					aria-hidden
					className="pointer-events-none absolute -top-[2px] -bottom-[2px] w-px bg-(--monti-border-strong)"
					style={{ left }} // design-allow: the rule of an ancestor that runs on past this row, from PICK_LINE_LEFT
				/>
			))}
			<span className="min-w-0 grow truncate">{label}</span>
			{count !== undefined && <Count className="shrink-0 font-normal">{count}</Count>}
		</button>
	);
}

export { MediaPicker, type MediaPickerFolder };
