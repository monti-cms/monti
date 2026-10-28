"use client";

import { Upload } from "@carbon/icons-react";
import type * as React from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { Count } from "./count";
import { DIALOG_ACTIONS, Dialog, DialogClose, DialogContent, DialogTitle } from "./dialog";
import { Input } from "./input";
import { useUiLabels } from "./labels";
import { TextButton } from "./text-button";

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
 * pill puts the file in at once; there is no step after it. The tiles are `children` (a `Tile` each, `FilePreview` for a file). The folder list is
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
	confirmDisabled,
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
	confirmDisabled?: boolean;
	/** Shown in place of the tiles when there is something to say instead (the list could not be loaded, nothing is there). */
	notice?: React.ReactNode;
	children?: React.ReactNode;
}) {
	const labels = useUiLabels();
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-monti-20 pb-monti-20 sm:max-w-[760px]">
				<DialogTitle>{title}</DialogTitle>
				<div className="grid grid-cols-[168px_minmax(0,1fr)] gap-monti-20">
					<nav aria-label={foldersLabel} className="flex flex-col gap-monti-2 self-start">
						<PickerFolder label={allLabel} on={folder === null} onClick={() => onFolderChange(null)} />
						{folders.map((item) => (
							<PickerFolder
								key={item.id}
								label={item.name}
								count={item.count}
								depth={item.depth}
								on={folder === item.id}
								onClick={() => onFolderChange(item.id)}
							/>
						))}
					</nav>
					<div className="flex min-w-0 flex-col gap-monti-12">
						<Input
							aria-label={searchLabel}
							placeholder={searchLabel}
							value={search}
							onChange={(event) => onSearchChange(event.target.value)}
						/>
						{/* 4px of room around the tiles so the ring of a picked one is not cut by the scrolling area. */}
						<div className="-m-monti-4 grid max-h-[min(24rem,50vh)] grid-cols-3 content-start gap-x-monti-12 gap-y-monti-16 overflow-y-auto p-monti-4">
							{notice ? <div className="col-span-3">{notice}</div> : children}
						</div>
					</div>
				</div>
				<div className={cn(DIALOG_ACTIONS, "mt-monti-4")}>
					<TextButton type="button" className="mr-auto" disabled={uploadDisabled} onClick={onUpload}>
						<Upload aria-hidden />
						{uploadLabel}
					</TextButton>
					<DialogClose render={<TextButton />}>{labels.cancel}</DialogClose>
					<Button type="button" disabled={confirmDisabled} onClick={onConfirm}>
						{confirmLabel}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function PickerFolder({
	label,
	count,
	depth = 0,
	on,
	onClick,
}: {
	label: string;
	count?: number;
	depth?: number;
	on: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-current={on ? "true" : undefined}
			onClick={onClick}
			style={depth > 0 ? { paddingLeft: 22 } : undefined}
			className={cn(
				"flex h-8 w-full min-w-0 cursor-pointer items-center gap-monti-10 rounded-monti-md border-0 bg-transparent px-monti-10 text-left text-monti-body outline-none hover:bg-monti-selected focus-visible:ring-3 focus-visible:ring-monti-contrast/20",
				on ? "bg-monti-current font-semibold text-monti-default" : "text-monti-muted",
			)}
		>
			<span className="min-w-0 grow truncate">{label}</span>
			{count !== undefined && <Count className="shrink-0 font-normal">{count}</Count>}
		</button>
	);
}

export { MediaPicker, type MediaPickerFolder };
