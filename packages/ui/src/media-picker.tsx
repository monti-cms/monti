"use client";

import type * as React from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { DIALOG_ACTIONS, Dialog, DialogClose, DialogContent, DialogTitle } from "./dialog";
import { Upload } from "./icons";
import { useUiLabels } from "./labels";
import { NAV_ROW } from "./nav-link";
import { SearchBox } from "./search-box";
import { folderTree, SidebarMenuSub, SidebarMenuSubButton } from "./sidebar";

/** One place in the folder list of the picker. `depth` 0 is a folder at the top, 1 one inside it. */
interface MediaPickerFolder {
	id: string;
	name: string;
	depth: number;
}

/** The deepest a folder is drawn, as in the sidebar's tree. */
const DEEPEST = 3;

/**
 * The library as a picker (images to insert, a cover image, files to attach), and a file browser: a 760px modal with the folders at the left, and at the right a search box over
 * what the open place holds, its `subfolders` (a `FolderTile` each) over its files as three columns of tiles (`children`: a `Tile` each, `FilePreview` for a file). "Upload" is at
 * the bottom left, Cancel and the one pill at the bottom right. Choosing and then pressing the pill puts the file in at once; there is no step after it. Until a file is picked the
 * pill is not there (`confirmHidden`). The folder list is `folders` under the top entry `topLabel`, drawn with the sidebar's own rows (no icon: the window is the library already);
 * `folder` is the open one, `null` for the top. While a search looks inside a folder, `searchIn` says where it looks.
 */
function MediaPicker({
	open,
	onOpenChange,
	title,
	topLabel,
	folders,
	folder,
	onFolderChange,
	foldersLabel,
	search,
	onSearchChange,
	searchLabel,
	searchIn,
	uploadLabel,
	onUpload,
	uploadDisabled,
	confirmLabel,
	onConfirm,
	confirmHidden,
	notice,
	subfolders,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	/** The top entry of the folder list: what is in no folder, and the folders at the top. */
	topLabel: string;
	folders: readonly MediaPickerFolder[];
	folder: string | null;
	onFolderChange: (id: string | null) => void;
	/** The name of the folder list, for screen readers. */
	foldersLabel: string;
	search: string;
	onSearchChange: (search: string) => void;
	/** The name and the placeholder of the search box. */
	searchLabel: string;
	/** Under the search box, while a search looks inside a folder: where it looks. */
	searchIn?: React.ReactNode;
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
	/** The folders the open place holds, over its files: a `FolderTile` each. */
	subfolders?: React.ReactNode;
	children?: React.ReactNode;
}) {
	const labels = useUiLabels();
	const depths = folders.map((item) => Math.min(item.depth, DEEPEST) as 0 | 1 | 2 | 3);
	const tree = folderTree(depths);
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-monti-20 pb-monti-20 sm:max-w-[760px]">
				<DialogTitle>{title}</DialogTitle>
				{/* One height, whatever a folder holds: both columns scroll inside it. */}
				<div className="grid h-[min(27rem,60vh)] grid-cols-[216px_minmax(0,1fr)] gap-monti-20">
					<nav aria-label={foldersLabel} className="flex min-h-0 scroll-py-monti-8 flex-col overflow-y-auto">
						<button
							type="button"
							aria-current={folder === null ? "page" : undefined}
							onClick={() => onFolderChange(null)}
							className={cn(NAV_ROW, "shrink-0 cursor-pointer text-monti-default")}
						>
							<span className="min-w-0 truncate">{topLabel}</span>
						</button>
						<SidebarMenuSub>
							{folders.map((item, index) => (
								<li key={item.id}>
									<SidebarMenuSubButton
										render={<button type="button" />}
										isActive={folder === item.id}
										aria-current={folder === item.id ? "page" : undefined}
										depth={depths[index]}
										tree={tree[index]}
										onClick={() => onFolderChange(item.id)}
									>
										<span>{item.name}</span>
									</SidebarMenuSubButton>
								</li>
							))}
						</SidebarMenuSub>
					</nav>
					<div className="flex min-h-0 min-w-0 flex-col gap-monti-12">
						<SearchBox
							aria-label={searchLabel}
							placeholder={searchLabel}
							value={search}
							onValueChange={onSearchChange}
							className="w-full shrink-0"
						/>
						{searchIn ? <div className="flex shrink-0">{searchIn}</div> : null}
						{/* 4px of room around the tiles so the ring of a picked one is not cut by the scrolling area. */}
						<div className="-m-monti-4 flex min-h-0 flex-1 scroll-py-monti-8 flex-col gap-monti-24 overflow-y-auto p-monti-4">
							{subfolders ? <div className="grid shrink-0 grid-cols-3 gap-monti-12">{subfolders}</div> : null}
							{notice ?? <div className="grid grid-cols-3 gap-x-monti-12 gap-y-monti-16">{children}</div>}
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

export { MediaPicker, type MediaPickerFolder };
