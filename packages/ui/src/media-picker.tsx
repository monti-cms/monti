"use client";

import * as React from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { DIALOG_ACTIONS, Dialog, DialogClose, DialogContent, DialogTitle } from "./dialog";
import { Upload } from "./icons";
import { useUiLabels } from "./labels";
import { SearchBox, type SearchTarget } from "./search-box";
import { TextButton } from "./text-button";

/** One folder of the library, in a list drawn depth first. `depth` 0 is a folder at the top, 1 one inside it. */
interface MediaPickerFolder {
	id: string;
	name: string;
	depth: number;
}

/** The folders above the one at `index` in a list drawn depth first, the top one first. */
function aboveOf(folders: readonly MediaPickerFolder[], index: number): MediaPickerFolder[] {
	const above: MediaPickerFolder[] = [];
	let depth = folders[index]?.depth ?? 0;
	for (let at = index - 1; at >= 0 && depth > 0; at--) {
		const item = folders[at];
		if (item && item.depth < depth) {
			above.unshift(item);
			depth = item.depth;
		}
	}
	return above;
}

/**
 * The library as a picker (images to insert, a cover image, files to attach), and a file browser with no tree beside it (2026-11-10, owner): an 896px modal, the size of
 * the library's own page, with the search at the right of the title's line. Under it the open place's path (`folders` and `folder`: the top `topLabel`, then each folder
 * above, each going there when pressed, the only way up) over its `subfolders` (a `FolderTile` each, the way in) and its files as four columns of tiles (`children`: a
 * `Tile` each, `FilePreview` for a file). "Upload" is at the bottom left, Cancel and the pill at the right; the pill is not there until a file is picked
 * (`confirmHidden`). While a search looks inside a folder, `scopes` is the chip in the search box that says where it looks (this folder, or all of them).
 */
function MediaPicker({
	open,
	onOpenChange,
	title,
	topLabel,
	folders,
	folder,
	onFolderChange,
	pathLabel,
	search,
	onSearchChange,
	searchLabel,
	scopes,
	scope,
	onScopeChange,
	scopeLabel,
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
	/** The top of the library, first in the path: what is in no folder, and the folders at the top. */
	topLabel: string;
	folders: readonly MediaPickerFolder[];
	folder: string | null;
	onFolderChange: (id: string | null) => void;
	/** The name of the open folder's path, for screen readers. */
	pathLabel: string;
	search: string;
	onSearchChange: (search: string) => void;
	/** The name and the placeholder of the search box. */
	searchLabel: string;
	/** While a search looks inside a folder: where it may look, the open folder first. */
	scopes?: readonly SearchTarget<"here" | "all">[];
	scope?: "here" | "all";
	onScopeChange?: (scope: "here" | "all") => void;
	/** The name of the scope's chip, for screen readers. */
	scopeLabel?: string;
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
	const openIndex = folders.findIndex((item) => item.id === folder);
	const openFolder = openIndex < 0 ? null : folders[openIndex];
	const path = openFolder ? [{ id: null, name: topLabel }, ...aboveOf(folders, openIndex)] : [];
	// The card or the step of the path that was pressed goes with the place it was in: the keyboard goes on from the new place's first card or file.
	const place = React.useRef<HTMLDivElement>(null);
	const lastFolder = React.useRef(folder);
	React.useEffect(() => {
		if (lastFolder.current === folder) return;
		lastFolder.current = folder;
		const active = place.current?.ownerDocument.activeElement;
		if (!active || active === place.current?.ownerDocument.body || active.matches("[role=dialog]"))
			place.current?.querySelector<HTMLElement>("button, [tabindex='0']")?.focus();
	}, [folder]);
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent size="xl" className="gap-monti-20 pb-monti-20">
				{/* The search sits on the title's line, as on the library's page: no line of its own over the tiles. */}
				<div className="flex items-center gap-monti-16 border-monti-contrast border-b pb-monti-12">
					<DialogTitle className="min-w-0 flex-1 truncate border-0 pb-0">{title}</DialogTitle>
					<SearchBox
						aria-label={searchLabel}
						placeholder={searchLabel}
						value={search}
						onValueChange={onSearchChange}
						scopes={scopes}
						scope={scope}
						onScopeChange={onScopeChange}
						targetLabel={scopeLabel}
						className="shrink-0"
					/>
				</div>
				{/* One height, whatever a folder holds: the tiles scroll inside it, under the path. */}
				<div className="flex h-[min(36rem,70vh)] min-w-0 flex-col gap-monti-16">
					<nav aria-label={pathLabel} className="flex min-w-0 shrink-0 items-baseline gap-monti-6 text-monti-note">
						{path.map((up) => (
							<React.Fragment key={up.id ?? "top"}>
								<TextButton variant="underline" quiet onClick={() => onFolderChange(up.id)}>
									{up.name}
								</TextButton>
								<span aria-hidden="true" className="text-monti-faint">
									/
								</span>
							</React.Fragment>
						))}
						<span aria-current="page" className="min-w-0 truncate text-monti-default">
							{openFolder?.name ?? topLabel}
						</span>
					</nav>
					{/* 4px of room around the tiles so the ring of a picked one is not cut by the scrolling area. */}
					<div
						ref={place}
						className="-m-monti-4 flex min-h-0 flex-1 scroll-py-monti-8 flex-col gap-monti-24 overflow-y-auto p-monti-4"
					>
						{subfolders ? <div className="grid shrink-0 grid-cols-4 gap-monti-12">{subfolders}</div> : null}
						{notice ?? <div className="grid grid-cols-4 gap-x-monti-12 gap-y-monti-16">{children}</div>}
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
