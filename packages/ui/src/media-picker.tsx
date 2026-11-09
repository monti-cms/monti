"use client";

import type * as React from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { Count } from "./count";
import { DIALOG_ACTIONS, Dialog, DialogClose, DialogContent, DialogTitle } from "./dialog";
import { Upload } from "./icons";
import { Input } from "./input";
import { useUiLabels } from "./labels";
import { NAV_ROW } from "./nav-link";
import { folderTree, SidebarMenuSub, SidebarMenuSubButton } from "./sidebar";

/** One place in the folder list of the picker. `depth` 0 is a folder at the top, 1 one inside it. */
interface MediaPickerFolder {
	id: string;
	name: string;
	depth: number;
	/** How many files it holds; left out where the number would not match what the picker shows. */
	count?: number;
}

/** The deepest a folder is drawn, as in the sidebar's tree. */
const DEEPEST = 3;

/**
 * The library as a picker (images to insert, a cover image, files to attach): a 760px modal with the folders at the left, a search box and the files as
 * three columns of tiles at the right, "Upload" at the bottom left, and Cancel and the one pill at the bottom right. Choosing and then pressing the
 * pill puts the file in at once; there is no step after it. Until a file is picked the pill is not there (`confirmHidden`). The tiles are `children` (a `Tile` each, `FilePreview` for a file). The folder list is
 * `folders` under the top entry `allLabel`, drawn with the sidebar's own rows (no icon: the window is the library already); `folder` is the picked one, `null` for all.
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
							<span className="min-w-0 truncate">{allLabel}</span>
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
										{item.count ? <Count>{item.count}</Count> : null}
									</SidebarMenuSubButton>
								</li>
							))}
						</SidebarMenuSub>
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

export { MediaPicker, type MediaPickerFolder };
