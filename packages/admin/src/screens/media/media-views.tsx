"use client";

import {
	type FileKind,
	fileKindOf,
	fileTypeLabel,
	formatFileSize,
	useSite,
	useTranslator,
} from "@monti-cms/core/client";
import type { Folder } from "@monti-cms/core/runtime";
import { File, FileArchive, FileText, FileType, Folder as FolderIcon, FolderOpen, FolderUp } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { MediaItem } from "../../api/media";
import { commonMessages } from "../../lib/common.messages";
import { cn } from "../../lib/utils/cn";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { folderKeyHandler } from "../admin-sidebar";
import { EntriesTableFolderRows } from "../entries-table-folder-rows";
import { screensMessages } from "../messages";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "../shared/action-menu";
import { writeDraggedEntries } from "../shared/entry-drag";
import { formatDateTime } from "../shared/format-date";
import { OPEN_ITEM } from "../shared/side-panel";
import { type FolderActions, folderMenuActions } from "../shared/use-folder-actions";
import { usageLabel } from "./media-item";
import { mediaMessages } from "./messages";

const FILE_ICONS: Record<FileKind, typeof FileText> = { pdf: FileType, archive: FileArchive, text: FileText };

/** Thumbnail for images, a type icon for other files. */
export function MediaThumb({ media, iconClassName }: { media: MediaItem; iconClassName?: string }) {
	const site = useSite();
	if (!site.api.isImageType(media.mimeType)) {
		const Icon = FILE_ICONS[fileKindOf(media.mimeType)];
		return <Icon className={cn("text-cms-muted-foreground", iconClassName)} aria-hidden />;
	}
	if (!media.publicUrl) return <File className={cn("text-cms-muted-foreground", iconClassName)} aria-hidden />;
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
		<ul
			className={cn(
				"grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6",
				dimmed && "opacity-60",
			)}
		>
			{explorer?.parent !== null && explorer?.parent !== undefined && onSelectFolder && (
				<li className="relative">
					<Button
						variant="outline"
						type="button"
						onClick={() => onSelectFolder(explorer.parent ?? "all")}
						className="h-auto w-full flex-col items-stretch gap-0 overflow-hidden rounded-lg bg-cms-card p-0 text-left font-normal hover:border-cms-foreground/30"
					>
						<span className="relative flex aspect-square items-center justify-center bg-cms-muted/50 text-cms-muted-foreground hover:text-cms-foreground">
							<FolderUp className="size-10" aria-hidden />
						</span>
						<span className="truncate p-2 font-medium text-cms-muted-foreground text-xs">{ts("list.folderUp")}</span>
					</Button>
				</li>
			)}
			{explorer?.folders.map((folder) => {
				const actions = folderRowMenu(folder);
				return (
					<ActionContextMenu key={`folder-${folder.id}`} actions={actions} trigger={<li className="relative" />}>
						<Button
							variant="outline"
							type="button"
							onClick={() => onSelectFolder?.(folder.id)}
							onKeyDown={folderActions ? folderKeyHandler(folder, folderActions) : undefined}
							className="h-auto w-full flex-col items-stretch gap-0 overflow-hidden rounded-lg bg-cms-card p-0 text-left font-normal hover:border-cms-foreground/30"
						>
							<span className="relative flex aspect-square items-center justify-center bg-cms-muted/50 text-cms-muted-foreground">
								<FolderIcon className="size-10 text-cms-muted-foreground" aria-hidden />
							</span>
							<span className="truncate p-2 font-medium text-xs">{folder.name}</span>
						</Button>
						<MoreActionsButton
							actions={actions}
							label={ts("list.folderActions", { name: folder.name })}
							className="absolute top-1 right-1 size-7 bg-cms-background/80"
						/>
					</ActionContextMenu>
				);
			})}
			{items.map((media) => (
				<ActionContextMenu key={media.id} actions={menuFor(media)} trigger={<li className="relative" />}>
					<Button
						variant="outline"
						type="button"
						draggable
						onDragStart={(event) => writeDraggedEntries(event, [{ id: media.id, expectedVersion: 0 }], media.filename)}
						aria-current={selectedId === media.id ? "true" : undefined}
						onClick={() => onSelect(media)}
						onKeyDown={deleteKey(media, onDeleteKey)}
						className={cn(
							"h-auto w-full flex-col items-stretch gap-0 overflow-hidden rounded-lg bg-cms-card p-0 text-left font-normal",
							selectedId === media.id
								? cn(OPEN_ITEM, "border-cms-foreground/40 hover:bg-cms-accent")
								: "hover:border-cms-foreground/30",
						)}
					>
						<span className="relative flex aspect-square items-center justify-center bg-cms-muted">
							{site.api.isImageType(media.mimeType) ? (
								<MediaThumb media={media} iconClassName="size-10" />
							) : (
								<span className="flex flex-col items-center gap-1.5 text-cms-muted-foreground">
									<MediaThumb media={media} iconClassName="size-10" />
									<span className="font-medium text-[10px]">{fileTypeLabel(media.filename, media.mimeType)}</span>
								</span>
							)}
							<Badge variant="secondary" className="absolute top-1.5 left-1.5 text-[10px]">
								{usageLabel(t, media)}
							</Badge>
						</span>
						<span className="truncate p-2 text-xs">{media.filename}</span>
					</Button>
					<MoreActionsButton
						actions={menuFor(media)}
						label={t("views.itemActions", { name: media.filename })}
						className="absolute top-1 right-1 size-7 bg-cms-background/80"
					/>
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
		<Table
			aria-label={t("views.table")}
			containerClassName="overflow-visible"
			className={cn(
				"table-fixed text-xs transition-opacity [&_td:first-child]:pl-4 lg:[&_td:first-child]:pl-6 [&_td:last-child]:pr-4 lg:[&_td:last-child]:pr-6 [&_th:first-child]:pl-4 lg:[&_th:first-child]:pl-6 [&_th:last-child]:pr-4 lg:[&_th:last-child]:pr-6",
				dimmed && "opacity-60",
			)}
		>
			<TableHeader className="sticky top-0 z-10 bg-cms-background [&_tr]:border-b">
				<TableRow>
					<TableHead className="w-14 font-normal text-cms-muted-foreground">
						<span className="sr-only">{t("views.preview")}</span>
					</TableHead>
					<TableHead className="font-normal text-cms-muted-foreground">{t("views.filename")}</TableHead>
					<TableHead className="w-28 font-normal text-cms-muted-foreground">{t("views.type")}</TableHead>
					<TableHead className="w-24 font-normal text-cms-muted-foreground">{t("views.size")}</TableHead>
					<TableHead className="w-28 font-normal text-cms-muted-foreground">{t("views.dimensions")}</TableHead>
					<TableHead className="w-20 font-normal text-cms-muted-foreground">{t("views.usage")}</TableHead>
					<TableHead className="w-40 font-normal text-cms-muted-foreground">{t("views.uploadedAt")}</TableHead>
					<TableHead className="w-10 font-normal text-cms-muted-foreground">
						<span className="sr-only">{t("views.actions")}</span>
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
									className={cn("cursor-pointer", isSelected && OPEN_ITEM)}
									draggable
									onDragStart={(event) =>
										writeDraggedEntries(event, [{ id: media.id, expectedVersion: 0 }], media.filename)
									}
									onClick={() => onSelect(media)}
								/>
							}
						>
							<TableCell className="py-1.5">
								<span className="flex size-9 items-center justify-center overflow-hidden rounded border bg-cms-muted">
									<MediaThumb media={media} iconClassName="size-4" />
								</span>
							</TableCell>
							<TableCell className="max-w-0">
								<button
									type="button"
									aria-current={isSelected ? "true" : undefined}
									onClick={(event) => {
										event.stopPropagation();
										onSelect(media);
									}}
									onKeyDown={deleteKey(media, onDeleteKey)}
									className="block w-full truncate text-left font-medium outline-none hover:underline focus-visible:underline"
								>
									{media.filename}
								</button>
							</TableCell>
							<TableCell className="text-cms-muted-foreground">
								{site.api.isImageType(media.mimeType)
									? (media.mimeType?.replace("image/", "").toUpperCase() ?? "—")
									: fileTypeLabel(media.filename, media.mimeType)}
							</TableCell>
							<TableCell className="tabular-nums">{formatFileSize(media.byteSize ?? 0)}</TableCell>
							<TableCell className="text-cms-muted-foreground tabular-nums">
								{media.width && media.height ? `${media.width}×${media.height}` : "—"}
							</TableCell>
							<TableCell>{usageLabel(t, media)}</TableCell>
							<TableCell className="text-cms-muted-foreground tabular-nums">
								{formatDateTime(site, media.createdAt, { dateStyle: "medium", timeStyle: "short" })}
							</TableCell>
							<TableCell onClick={(event) => event.stopPropagation()}>
								<MoreActionsButton
									actions={menuFor(media)}
									label={t("views.itemActions", { name: media.filename })}
									className="size-7"
								/>
							</TableCell>
						</ActionContextMenu>
					);
				})}
			</TableBody>
		</Table>
	);
}
