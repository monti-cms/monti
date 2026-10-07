"use client";

import {
	type FileKind,
	fileKindOf,
	fileTypeLabel,
	formatFileSize,
	useSite,
	useTranslator,
} from "@monti-cms/core/client";
import { File, FileArchive, FileText, FileType } from "lucide-react";
import type { KeyboardEvent } from "react";
import { cn } from "../../lib/utils/cn";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "../shared/action-menu";
import { formatDateTime } from "../shared/format-date";
import { OPEN_ITEM } from "../shared/side-panel";
import { type MediaItem, usageLabel } from "./media-item";
import { mediaMessages } from "./messages";

const FILE_ICONS: Record<FileKind, typeof FileText> = { pdf: FileType, archive: FileArchive, text: FileText };

/** Thumbnail for images, a type icon for other files. */
export function MediaThumb({ media, iconClassName }: { media: MediaItem; iconClassName?: string }) {
	const site = useSite();
	if (!site.api.isImageMime(media.mimeType)) {
		const Icon = FILE_ICONS[fileKindOf(media.mimeType)];
		return <Icon className={cn("text-cms-muted-foreground", iconClassName)} aria-hidden />;
	}
	if (!media.publicUrl) return <File className={cn("text-cms-muted-foreground", iconClassName)} aria-hidden />;
	// biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic
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
}

const deleteKey = (media: MediaItem, onDeleteKey: (media: MediaItem) => void) => (event: KeyboardEvent) => {
	if (event.key === "Delete" && media.referencesCount === 0) {
		event.preventDefault();
		onDeleteKey(media);
	}
};

/** Grid view. Shows the thumbnail and usage state large. */
export function MediaGrid({ items, selectedId, dimmed, onSelect, menuFor, onDeleteKey }: MediaViewProps) {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	return (
		<ul
			className={cn(
				"grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6",
				dimmed && "opacity-60",
			)}
		>
			{items.map((media) => (
				<ActionContextMenu key={media.id} actions={menuFor(media)} trigger={<li className="relative" />}>
					<Button
						variant="outline"
						type="button"
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
							{site.api.isImageMime(media.mimeType) ? (
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
export function MediaTable({ items, selectedId, dimmed, onSelect, menuFor, onDeleteKey }: MediaViewProps) {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	return (
		<Table aria-label={t("views.table")} className={cn("text-xs transition-opacity", dimmed && "opacity-60")}>
			<TableHeader>
				<TableRow>
					<TableHead className="w-12">
						<span className="sr-only">{t("views.preview")}</span>
					</TableHead>
					<TableHead>{t("views.filename")}</TableHead>
					<TableHead className="w-28">{t("views.type")}</TableHead>
					<TableHead className="w-24">{t("views.size")}</TableHead>
					<TableHead className="w-28">{t("views.dimensions")}</TableHead>
					<TableHead className="w-20">{t("views.usage")}</TableHead>
					<TableHead className="w-40">{t("views.uploadedAt")}</TableHead>
					<TableHead className="w-10">
						<span className="sr-only">{t("views.actions")}</span>
					</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
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
								{site.api.isImageMime(media.mimeType)
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
