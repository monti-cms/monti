"use client";

import type { Folder } from "@monti-cms/core/site";
import { type FileKind, fileKindOf, fileTypeLabel, formatFileSize, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Badge,
	Box,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Text,
	TextLink,
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

/** Thumbnail for images, a type icon for other files. */
export function MediaThumb({ media, iconSize }: { media: MediaItem; iconSize: number }) {
	const site = useSite();
	if (!site.api.isImageType(media.mimeType)) {
		const Icon = FILE_ICONS[fileKindOf(media.mimeType)];
		return (
			<Text tone="muted">
				<Icon size={iconSize} aria-hidden />
			</Text>
		);
	}
	if (!media.publicUrl)
		return (
			<Text tone="muted">
				<File size={iconSize} aria-hidden />
			</Text>
		);
	// design-system: needs an Image part (fills its frame, cropped to cover)
	return <img src={media.publicUrl} alt="" loading="lazy" className="h-full w-full object-cover" />;
}

export interface MediaViewProps {
	items: readonly MediaItem[];
	/** The file open in the right detail panel. Highlighted with `OPEN_ITEM`. */
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
		// design-system: needs Grid columns 2/3/4/6 by screen width, and a dimmed (opacity) state for rows that are reloading
		<ul
			className={
				dimmed
					? "grid grid-cols-2 gap-comfortable opacity-60 transition-opacity sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6"
					: "grid grid-cols-2 gap-comfortable transition-opacity sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6"
			}
		>
			{explorer?.parent !== null && explorer?.parent !== undefined && onSelectFolder && (
				<Box as="li" position="relative">
					{/* design-system: needs a Tile part (a card button: square preview on top, name under it) */}
					<button
						type="button"
						onClick={() => onSelectFolder(explorer.parent ?? "all")}
						className="flex w-full cursor-pointer flex-col items-stretch overflow-hidden rounded-md border border-monti-muted bg-monti-surface text-left outline-none hover:border-monti-emphasis focus-visible:ring-3 focus-visible:ring-monti-focus-soft"
					>
						<span className="relative flex aspect-square items-center justify-center bg-monti-inset text-monti-muted hover:text-monti-default">
							<FolderUp size={40} aria-hidden />
						</span>
						<Box padding="condensed">
							<Text as="div" variant="caption" tone="muted" weight="medium" truncate>
								{ts("list.folderUp")}
							</Text>
						</Box>
					</button>
				</Box>
			)}
			{explorer?.folders.map((folder) => {
				const actions = folderRowMenu(folder);
				return (
					<ActionContextMenu
						key={`folder-${folder.id}`}
						actions={actions}
						trigger={<Box as="li" position="relative" />}
					>
						{/* design-system: needs a Tile part (a card button: square preview on top, name under it) */}
						<button
							type="button"
							onClick={() => onSelectFolder?.(folder.id)}
							onKeyDown={folderActions ? folderKeyHandler(folder, folderActions) : undefined}
							className="flex w-full cursor-pointer flex-col items-stretch overflow-hidden rounded-md border border-monti-muted bg-monti-surface text-left outline-none hover:border-monti-emphasis focus-visible:ring-3 focus-visible:ring-monti-focus-soft"
						>
							<span className="relative flex aspect-square items-center justify-center bg-monti-inset text-monti-muted">
								<FolderIcon size={40} aria-hidden />
							</span>
							<Box padding="condensed">
								<Text as="div" variant="caption" weight="medium" truncate>
									{folder.name}
								</Text>
							</Box>
						</button>
						{/* design-system: needs a corner overlay position (the actions button sits on the tile's top right) */}
						<span className="absolute top-1 right-1">
							<MoreActionsButton actions={actions} label={ts("list.folderActions", { name: folder.name })} />
						</span>
					</ActionContextMenu>
				);
			})}
			{items.map((media) => (
				<ActionContextMenu key={media.id} actions={menuFor(media)} trigger={<Box as="li" position="relative" />}>
					{/* design-system: needs a Tile part (a card button: square preview on top, name under it; a selected look) */}
					<button
						type="button"
						draggable
						onDragStart={(event) => writeDraggedEntries(event, [{ id: media.id, expectedVersion: 0 }], media.filename)}
						aria-current={selectedId === media.id ? "true" : undefined}
						onClick={() => onSelect(media)}
						onKeyDown={deleteKey(media, onDeleteKey)}
						className={`flex w-full cursor-pointer flex-col items-stretch overflow-hidden rounded-md border border-monti-muted bg-monti-surface text-left outline-none hover:border-monti-emphasis focus-visible:ring-3 focus-visible:ring-monti-focus-soft ${
							selectedId === media.id ? "border-monti-emphasis bg-monti-selected hover:bg-monti-hover" : ""
						}`}
					>
						<span className="relative flex aspect-square items-center justify-center bg-monti-neutral">
							{site.api.isImageType(media.mimeType) ? (
								<MediaThumb media={media} iconSize={40} />
							) : (
								<Stack align="center" gap="condensed">
									<MediaThumb media={media} iconSize={40} />
									<Text variant="micro" tone="muted" weight="medium">
										{fileTypeLabel(media.filename, media.mimeType)}
									</Text>
								</Stack>
							)}
							{/* design-system: needs a corner overlay position (the usage badge sits on the preview's top left) */}
							<span className="absolute top-1.5 left-1.5">
								<Badge variant="secondary">{usageLabel(t, media)}</Badge>
							</span>
						</span>
						<Box padding="condensed">
							<Text as="div" variant="caption" mono truncate>
								{media.filename}
							</Text>
						</Box>
					</button>
					{/* design-system: needs a corner overlay position (the actions button sits on the tile's top right) */}
					<span className="absolute top-1 right-1">
						<MoreActionsButton actions={menuFor(media)} label={t("views.itemActions", { name: media.filename })} />
					</span>
				</ActionContextMenu>
			))}
		</ul>
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
		// design-system: needs a dimmed (opacity) state for rows that are reloading
		<div className={dimmed ? "opacity-60 transition-opacity" : "transition-opacity"}>
			{/* design-system: needs a sticky table header and fixed column layout */}
			<Table aria-label={t("views.table")} inset="page">
				<TableHeader>
					<TableRow>
						<TableHead width="xs">
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
									{/* design-system: needs a Thumbnail part (a small square frame for a preview image or file icon) */}
									<span className="flex size-9 items-center justify-center overflow-hidden rounded-md border border-monti-muted bg-monti-neutral">
										<MediaThumb media={media} iconSize={16} />
									</span>
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
		</div>
	);
}
