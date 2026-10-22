"use client";

import type { Folder } from "@monti-cms/core/site";
import { type FileKind, fileKindOf, fileTypeLabel, formatFileSize, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Badge,
	Box,
	Grid,
	Image,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Text,
	TextLink,
	Tile,
} from "@monti-cms/ui";
import { File, FileArchive, FileText, FileType, Folder as FolderIcon, FolderOpen, FolderUp } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { MediaItem } from "../../api/media";
import { commonMessages } from "../../lib/common.messages";
import { folderKeyHandler } from "../admin-sidebar";
import { EntriesTableFolderRows } from "../entries-table-folder-rows";
import { screensMessages } from "../messages";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "../shared/action-menu";
import { writeDraggedEntries } from "../shared/entry-drag";
import { formatDateTime } from "../shared/format-date";
import { type FolderActions, folderMenuActions } from "../shared/use-folder-actions";
import { usageLabel } from "./media-item";
import { mediaMessages } from "./messages";

const FILE_ICONS: Record<FileKind, typeof FileText> = { pdf: FileType, archive: FileArchive, text: FileText };

/** The icon an image frame shows in place of a picture: the type of a file, or a plain file when an image has no address yet. */
export const fallbackFor = (media: MediaItem, isImage: boolean) =>
	isImage ? File : FILE_ICONS[fileKindOf(media.mimeType)];

export interface MediaViewProps {
	items: readonly MediaItem[];
	/** The file open in the right detail panel. */
	selectedId: string | null;
	/** Dims the previous rows while conditions change. */
	dimmed: boolean;
	onSelect: (media: MediaItem) => void;
	menuFor: (media: MediaItem) => MenuAction[];
	/** Delete key. Only unused files can be deleted. */
	onDeleteKey: (media: MediaItem) => void;
	explorer?: { folders: Folder[]; parent: string | null } | null;
	folders?: Folder[];
	folderActions?: FolderActions;
	onSelectFolder?: (folder: string) => void;
}

const deleteKey = (media: MediaItem, onDeleteKey: (media: MediaItem) => void) => (event: KeyboardEvent) => {
	if (event.key === "Delete" && media.referencesCount === 0) {
		event.preventDefault();
		onDeleteKey(media);
	}
};

/** Grid view. Shows the thumbnail and usage state large. */
export function MediaGrid({
	items,
	selectedId,
	dimmed,
	onSelect,
	menuFor,
	onDeleteKey,
	explorer,
	folders,
	folderActions,
	onSelectFolder,
}: MediaViewProps) {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	const tc = useTranslator(commonMessages);
	const ts = useTranslator(screensMessages);

	const folderRowMenu = (folder: Folder): MenuAction[] =>
		folderActions
			? [
					{
						kind: "item",
						label: tc("open"),
						icon: FolderOpen,
						onSelect: () => onSelectFolder?.(folder.id),
					},
					{ kind: "separator" },
					...folderMenuActions(site, folder, folders ?? [], folderActions),
				]
			: [];
	return (
		<Grid as="ul" columns="tiles" gap="comfortable" dimmed={dimmed}>
			{explorer?.parent !== null && explorer?.parent !== undefined && onSelectFolder && (
				<li>
					<Tile
						preview={<Image alt="" ratio="square" radius="none" fallback={FolderUp} />}
						title={ts("list.folderUp")}
						onClick={() => onSelectFolder(explorer.parent ?? "all")}
					/>
				</li>
			)}
			{explorer?.folders.map((folder) => {
				const actions = folderRowMenu(folder);
				return (
					<ActionContextMenu key={`folder-${folder.id}`} actions={actions} trigger={<li />}>
						<Tile
							preview={<Image alt="" ratio="square" radius="none" fallback={FolderIcon} />}
							title={folder.name}
							action={<MoreActionsButton actions={actions} label={ts("list.folderActions", { name: folder.name })} />}
							onClick={() => onSelectFolder?.(folder.id)}
							onKeyDown={folderActions ? folderKeyHandler(folder, folderActions) : undefined}
						/>
					</ActionContextMenu>
				);
			})}
			{items.map((media) => {
				const isImage = site.api.isImageType(media.mimeType);
				return (
					<ActionContextMenu key={media.id} actions={menuFor(media)} trigger={<li />}>
						<Tile
							draggable
							onDragStart={(event) =>
								writeDraggedEntries(event, [{ id: media.id, expectedVersion: 0 }], media.filename)
							}
							aria-current={selectedId === media.id ? "true" : undefined}
							selected={selectedId === media.id}
							preview={
								<Image
									src={isImage ? media.publicUrl : undefined}
									alt=""
									ratio="square"
									radius="none"
									fallback={fallbackFor(media, isImage)}
								/>
							}
							title={media.filename}
							detail={isImage ? undefined : fileTypeLabel(media.filename, media.mimeType)}
							badge={<Badge variant="secondary">{usageLabel(t, media)}</Badge>}
							action={
								<MoreActionsButton actions={menuFor(media)} label={t("views.itemActions", { name: media.filename })} />
							}
							onClick={() => onSelect(media)}
							onKeyDown={deleteKey(media, onDeleteKey)}
						/>
					</ActionContextMenu>
				);
			})}
		</Grid>
	);
}

/** List view. Shows name, type, size, dimensions, usage state and upload date, one per row. */
export function MediaTable({
	items,
	selectedId,
	dimmed,
	onSelect,
	menuFor,
	onDeleteKey,
	explorer,
	folders,
	folderActions,
	onSelectFolder,
}: MediaViewProps) {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	return (
		<Box dimmed={dimmed}>
			<Table aria-label={t("views.table")} inset="page" layout="fixed" stickyHeader container="none">
				<TableHeader>
					<TableRow>
						<TableHead width="sm">
							<Text srOnly>{t("views.preview")}</Text>
						</TableHead>
						<TableHead>{t("views.filename")}</TableHead>
						<TableHead width="md">{t("views.type")}</TableHead>
						<TableHead width="sm">{t("views.size")}</TableHead>
						<TableHead width="md">{t("views.dimensions")}</TableHead>
						<TableHead width="sm">{t("views.usage")}</TableHead>
						<TableHead width="lg">{t("views.uploadedAt")}</TableHead>
						<TableHead width="xs">
							<Text srOnly>{t("views.actions")}</Text>
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{explorer && folders && onSelectFolder && (
						<EntriesTableFolderRows
							explorer={explorer}
							folders={folders}
							folderActions={folderActions}
							visibleCount={8}
							onSelectFolder={onSelectFolder}
						/>
					)}
					{items.map((media) => {
						const isSelected = selectedId === media.id;
						return (
							<ActionContextMenu
								key={media.id}
								actions={menuFor(media)}
								trigger={
									<TableRow
										aria-current={isSelected ? "true" : undefined}
										selected={isSelected}
										draggable
										onDragStart={(event) =>
											writeDraggedEntries(event, [{ id: media.id, expectedVersion: 0 }], media.filename)
										}
										onClick={() => onSelect(media)}
									/>
								}
							>
								<TableCell>
									<Image
										src={site.api.isImageType(media.mimeType) ? media.publicUrl : undefined}
										alt=""
										size="thumb"
										border
										fallback={fallbackFor(media, site.api.isImageType(media.mimeType))}
									/>
								</TableCell>
								<TableCell truncate>
									<TextLink
										render={<button type="button" />}
										underline="hover"
										mono
										aria-current={isSelected ? "true" : undefined}
										onClick={(event) => {
											event.stopPropagation();
											onSelect(media);
										}}
										onKeyDown={deleteKey(media, onDeleteKey)}
									>
										{media.filename}
									</TextLink>
								</TableCell>
								<TableCell tone="muted">
									{site.api.isImageType(media.mimeType)
										? (media.mimeType?.replace("image/", "").toUpperCase() ?? "—")
										: fileTypeLabel(media.filename, media.mimeType)}
								</TableCell>
								<TableCell>{formatFileSize(media.byteSize ?? 0)}</TableCell>
								<TableCell tone="muted">
									{media.width && media.height ? `${media.width}×${media.height}` : "—"}
								</TableCell>
								<TableCell>{usageLabel(t, media)}</TableCell>
								<TableCell tone="muted">
									{formatDateTime(site, media.createdAt, { dateStyle: "medium", timeStyle: "short" })}
								</TableCell>
								<TableCell onClick={(event) => event.stopPropagation()}>
									<MoreActionsButton
										actions={menuFor(media)}
										label={t("views.itemActions", { name: media.filename })}
									/>
								</TableCell>
							</ActionContextMenu>
						);
					})}
				</TableBody>
			</Table>
		</Box>
	);
}
