"use client";

import { Document, FolderParent } from "@carbon/icons-react";
import { type FolderListItem, formatFileSize, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	DropArea,
	FilePreview,
	FolderTile,
	Grid,
	Image,
	RowActions,
	RowCheck,
	RowTitle,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
	Tile,
} from "@monti-cms/ui";
import type { DragEvent, KeyboardEvent } from "react";
import type { MediaItem } from "../../api/media";
import { EntriesTableFolderRows } from "../entries-table-folder-rows";
import { ACTIONS_SIZE } from "../entries-table-widths";
import { shortDate } from "../list-row-dates";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "../shared/action-menu";
import { writeDraggedEntries } from "../shared/entry-drag";
import { FolderNameField } from "../shared/folder-name-field";
import { type FolderActions, folderKeyHandler } from "../shared/use-folder-actions";
import { formatLabel, usageLabel } from "./media-item";
import { folderPathBelow } from "./media-state";
import { extensionOf } from "./media-upload";
import { mediaMessages } from "./messages";
import { UploadTiles } from "./upload-tiles";
import type { useFileDrop } from "./use-file-drop";
import type { MediaLibraryView } from "./use-media-library";
import type { MediaUploads } from "./use-media-uploads";

export interface MediaViewProps {
	library: MediaLibraryView;
	uploads: MediaUploads;
	drop: ReturnType<typeof useFileDrop>;
	folderActions: FolderActions;
	menuFor: (media: MediaItem) => MenuAction[];
	folderMenuFor: (folder: FolderListItem) => MenuAction[];
	onTrash: (media: MediaItem) => void;
}

/** Where a file is while a search lists files from several folders: its path below the open folder; nothing for a file in the open folder. */
function usePathBelow(library: MediaLibraryView) {
	const t = useTranslator(mediaMessages);
	return (media: MediaItem): string | undefined =>
		library.searching
			? (folderPathBelow(library.folders, library.state.folder || null, media.folderId, t("result.noFolder")) ??
				undefined)
			: undefined;
}

/** The line under a file's name: where it is (only when it is not in the open folder), its dimensions or its type and size, then its use. */
function useDetail(library: MediaLibraryView) {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	const where = usePathBelow(library);
	return (media: MediaItem): string =>
		[
			where(media),
			...(site.api.isImageType(media.mimeType)
				? [`${media.width}×${media.height}`]
				: [extensionOf(media.filename).toUpperCase(), formatFileSize(media.byteSize ?? 0)]),
			usageLabel(t, media),
		]
			.filter(Boolean)
			.join(" · ");
}

/** Dragging a picked file takes every picked file with it, as in the entry list; any other file goes alone. */
function useStartDrag(library: MediaLibraryView) {
	const t = useTranslator(mediaMessages);
	return (event: DragEvent, media: MediaItem) => {
		const group = library.picked.has(media.id) ? [...library.picked] : [media.id];
		writeDraggedEntries(
			event,
			group.map((id) => ({ id, expectedVersion: 0 })),
			group.length === 1 ? media.filename : t("bulk.count", { count: group.length }),
		);
	};
}

const onDelete = (media: MediaItem, trash: (media: MediaItem) => void) => (event: KeyboardEvent) => {
	if (event.key === "Delete") {
		event.preventDefault();
		trash(media);
	}
};

/** Grid view: the folders (with the way up), then the files, inside the frame that files can be dropped on. */
export function MediaGrid({ library, uploads, drop, folderActions, menuFor, folderMenuFor, onTrash }: MediaViewProps) {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	const detail = useDetail(library);
	const startDrag = useStartDrag(library);
	const { explorer, picked, open } = library;
	const naming = folderActions.naming;
	const showFolders =
		explorer && (explorer.parent !== null || explorer.folders.length > 0 || naming?.mode === "create");

	return (
		<DropArea over={drop.over} {...drop.area}>
			<Box paddingX={12} paddingTop={24}>
				<Stack gap={24}>
					{showFolders && (
						<Grid as="ul" columns="folders" dense={open !== null}>
							{explorer.parent !== null && (
								<li>
									<FolderTile
										icon={<FolderParent aria-hidden />}
										name={t("folder.up")}
										onClick={() => library.goToFolder(explorer.parent ?? "")}
									/>
								</li>
							)}
							{explorer.folders.map((folder) => {
								if (naming?.mode === "rename" && naming.folder.id === folder.id) {
									return (
										<li key={folder.id}>
											<FolderTile selected>
												<FolderNameField naming={naming} actions={folderActions} fill />
											</FolderTile>
										</li>
									);
								}
								const actions = folderMenuFor(folder);
								return (
									<ActionContextMenu key={folder.id} actions={actions} trigger={<li />}>
										<FolderTile
											ref={(button: HTMLButtonElement | null) => {
												if (button && folderActions.focusFolderId === folder.id) {
													button.focus();
													folderActions.focusSettled();
												}
											}}
											name={folder.name}
											count={folder.entryCount}
											dropTarget={drop.target === folder.id}
											action={
												<MoreActionsButton actions={actions} label={t("folder.actions", { name: folder.name })} />
											}
											onClick={() => library.goToFolder(folder.id)}
											onKeyDown={folderKeyHandler(folder, folderActions)}
											{...drop.folder(folder.id)}
										/>
									</ActionContextMenu>
								);
							})}
							{naming?.mode === "create" && (
								<li>
									<FolderTile selected>
										<FolderNameField naming={naming} actions={folderActions} fill />
									</FolderTile>
								</li>
							)}
						</Grid>
					)}
					<Grid as="ul" columns="tiles" dense={open !== null} dimmed={library.isRefreshing}>
						<UploadTiles uploads={uploads} />
						{library.items.map((media) => {
							const isImage = site.api.isImageType(media.mimeType);
							return (
								<ActionContextMenu key={media.id} actions={menuFor(media)} trigger={<li />}>
									<Tile
										draggable
										onDragStart={(event) => startDrag(event, media)}
										aria-current={open?.id === media.id ? "true" : undefined}
										current={open?.id === media.id}
										selected={picked.has(media.id)}
										picking={picked.size > 0}
										onSelectedChange={(on) => library.togglePicked(media.id, on)}
										selectLabel={t("tile.select", { name: media.filename })}
										preview={
											isImage ? (
												<Image src={media.publicUrl} alt="" ratio="photo" radius="none" fallback={Document} />
											) : (
												<FilePreview ext={extensionOf(media.filename).toUpperCase()} />
											)
										}
										title={media.filename}
										detail={detail(media)}
										action={
											<MoreActionsButton actions={menuFor(media)} label={t("tile.actions", { name: media.filename })} />
										}
										onClick={() => void library.openFile(media.id)}
										onKeyDown={onDelete(media, onTrash)}
									/>
								</ActionContextMenu>
							);
						})}
					</Grid>
				</Stack>
			</Box>
		</DropArea>
	);
}

/**
 * The columns of the list in px, in order: the thumbnail (the cell's 12px at the left, the 40px picture and 10px), the name that takes the rest, then use,
 * format, size, dimensions, day and the ⋯. A fixed list takes its widths from here, so a row that spans columns (a folder's) leaves them where they are.
 */
const COLUMNS = [62, undefined, 100, 72, 84, 104, 72, ACTIONS_SIZE] as const;

/**
 * List view: a row per file with its use, format, size, dimensions and day, under the folders. There is no row of column names: the conditions and the order
 * are in the bar above. The uploads wait above it as tiles.
 */
export function MediaTable({ library, uploads, drop, folderActions, menuFor, onTrash }: MediaViewProps) {
	const site = useSite();
	const startDrag = useStartDrag(library);
	const t = useTranslator(mediaMessages);
	const { explorer, picked, open } = library;
	const where = usePathBelow(library);
	return (
		<DropArea over={drop.over} {...drop.area}>
			{uploads.queue.length > 0 && (
				<Box paddingX={12} paddingTop={24} paddingBottom={16}>
					<Grid as="ul" columns="tiles">
						<UploadTiles uploads={uploads} />
					</Grid>
				</Box>
			)}
			<Box dimmed={library.isRefreshing}>
				<Table aria-label={t("table.label")} layout="fixed" container="none" columns={COLUMNS}>
					<TableBody>
						{explorer && (
							<EntriesTableFolderRows
								explorer={{ folders: explorer.folders, parent: explorer.parent }}
								folders={library.folders}
								folderActions={folderActions}
								layout="thumb"
								span={7}
								countLabel={(count) => String(count)}
								onSelectFolder={(id) => library.goToFolder(id === "all" ? "" : id)}
							/>
						)}
						{library.items.map((media) => {
							const isImage = site.api.isImageType(media.mimeType);
							const isPicked = picked.has(media.id);
							return (
								<ActionContextMenu
									key={media.id}
									actions={menuFor(media)}
									trigger={
										<TableRow
											aria-current={open?.id === media.id ? "true" : undefined}
											selected={isPicked}
											draggable
											onDragStart={(event) => startDrag(event, media)}
											onClick={() => void library.openFile(media.id)}
										/>
									}
								>
									<TableCell>
										<RowCheck
											checked={isPicked}
											onCheckedChange={(on) => library.togglePicked(media.id, on)}
											label={t("tile.select", { name: media.filename })}
										/>
										<Image src={isImage ? media.publicUrl : undefined} alt="" ratio="photo" size="row" radius="sm" />
									</TableCell>
									<TableCell truncate>
										<RowTitle title={media.filename} address={where(media)} onKeyDown={onDelete(media, onTrash)} />
									</TableCell>
									<TableCell>
										<Text as="span" variant="note" tone={media.referencesCount > 0 ? "muted" : "faint"}>
											{usageLabel(t, media)}
										</Text>
									</TableCell>
									<TableCell>
										<Text as="span" mono variant="meta" tone="muted">
											{formatLabel(media, isImage)}
										</Text>
									</TableCell>
									<TableCell align="end">
										<Text as="span" mono variant="meta" tone="muted">
											{formatFileSize(media.byteSize ?? 0)}
										</Text>
									</TableCell>
									<TableCell align="end">
										{media.width && media.height ? (
											<Text as="span" mono variant="meta" tone="muted">
												{`${media.width}×${media.height}`}
											</Text>
										) : null}
									</TableCell>
									<TableCell align="end">
										<Text as="span" mono variant="meta" tone="muted">
											{shortDate(site, media.createdAt)}
										</Text>
									</TableCell>
									<TableCell onClick={(event) => event.stopPropagation()}>
										<RowActions>
											<MoreActionsButton actions={menuFor(media)} label={t("tile.actions", { name: media.filename })} />
										</RowActions>
									</TableCell>
								</ActionContextMenu>
							);
						})}
					</TableBody>
				</Table>
			</Box>
		</DropArea>
	);
}
