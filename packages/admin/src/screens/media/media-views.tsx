"use client";

import { Document, FolderParent } from "@carbon/icons-react";
import { type FolderListItem, fileTypeLabel, formatFileSize, useSite, useTranslator } from "@monti-cms/core/site";
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
	TableHead,
	TableHeader,
	TableRow,
	Text,
	Tile,
} from "@monti-cms/ui";
import type { KeyboardEvent } from "react";
import type { MediaItem } from "../../api/media";
import { EntriesTableFolderRows } from "../entries-table-folder-rows";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "../shared/action-menu";
import { writeDraggedEntries } from "../shared/entry-drag";
import { FolderNameField } from "../shared/folder-name-field";
import { formatDateTime } from "../shared/format-date";
import { type FolderActions, folderKeyHandler } from "../shared/use-folder-actions";
import { usageLabel } from "./media-item";
import { folderPathLabel } from "./media-state";
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

/** The line under a file's name: while a search or a filter lists files from several folders, where each is; otherwise its size or dimensions; then its use. */
function useDetail(library: MediaLibraryView) {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	return (media: MediaItem): string => {
		const parts = library.filtered
			? [folderPathLabel(library.folders, media.folderId, t("result.noFolder"))]
			: [
					...(site.api.isImageType(media.mimeType)
						? [`${media.width}×${media.height}`]
						: [extensionOf(media.filename).toUpperCase(), formatFileSize(media.byteSize ?? 0)]),
				];
		return [...parts, usageLabel(t, media)].join(" · ");
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
	const { explorer, picked, open } = library;
	const naming = folderActions.naming;
	const showFolders =
		explorer && (explorer.parent !== null || explorer.folders.length > 0 || naming?.mode === "create");

	return (
		<DropArea over={drop.over} {...drop.area}>
			<Box paddingX={12} paddingTop={24}>
				<Stack gap={24}>
					{showFolders && (
						<Grid as="ul" columns="folders">
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
											<FolderTile>
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
									<FolderTile>
										<FolderNameField naming={naming} actions={folderActions} fill />
									</FolderTile>
								</li>
							)}
						</Grid>
					)}
					<Grid as="ul" columns="tiles" dimmed={library.isRefreshing}>
						<UploadTiles uploads={uploads} />
						{library.items.map((media) => {
							const isImage = site.api.isImageType(media.mimeType);
							return (
								<ActionContextMenu key={media.id} actions={menuFor(media)} trigger={<li />}>
									<Tile
										draggable
										onDragStart={(event) =>
											writeDraggedEntries(event, [{ id: media.id, expectedVersion: 0 }], media.filename)
										}
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

/** List view: a row per file with its use, type, size, dimensions and day. The uploads wait above it as tiles. */
export function MediaTable({ library, uploads, drop, folderActions, menuFor, onTrash }: MediaViewProps) {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	const { explorer, picked, open } = library;
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
				<Table aria-label={t("table.label")} layout="fixed" stickyHeader container="none">
					<TableHeader>
						<TableRow>
							<TableHead width="xs">
								<Text srOnly>{t("table.name")}</Text>
							</TableHead>
							<TableHead>{t("table.name")}</TableHead>
							<TableHead width="sm">{t("table.usage")}</TableHead>
							<TableHead width="md">{t("table.type")}</TableHead>
							<TableHead width="sm" align="end">
								{t("table.size")}
							</TableHead>
							<TableHead width="md" align="end">
								{t("table.dimensions")}
							</TableHead>
							<TableHead width="lg" align="end">
								{t("table.uploadedAt")}
							</TableHead>
							<TableHead width="xs">
								<Text srOnly>{t("table.actions")}</Text>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{explorer && (
							<EntriesTableFolderRows
								explorer={{ folders: explorer.folders, parent: explorer.parent }}
								folders={library.folders}
								folderActions={folderActions}
								span={7}
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
											onDragStart={(event) =>
												writeDraggedEntries(event, [{ id: media.id, expectedVersion: 0 }], media.filename)
											}
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
										<Image src={isImage ? media.publicUrl : undefined} alt="" size="thumb" border fallback={Document} />
									</TableCell>
									<TableCell truncate>
										<RowTitle
											title={media.filename}
											address={
												library.filtered
													? folderPathLabel(library.folders, media.folderId, t("result.noFolder"))
													: undefined
											}
											onKeyDown={onDelete(media, onTrash)}
										/>
									</TableCell>
									<TableCell tone="muted">{usageLabel(t, media)}</TableCell>
									<TableCell tone="muted">
										{isImage
											? (media.mimeType?.replace("image/", "").toUpperCase() ?? "—")
											: fileTypeLabel(media.filename, media.mimeType)}
									</TableCell>
									<TableCell align="end" tone="muted">
										{formatFileSize(media.byteSize ?? 0)}
									</TableCell>
									<TableCell align="end" tone="muted">
										{media.width && media.height ? `${media.width}×${media.height}` : "—"}
									</TableCell>
									<TableCell align="end" tone="muted">
										{formatDateTime(site, media.createdAt, { dateStyle: "medium" })}
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
