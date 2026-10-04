"use client";

import {
	createTranslator,
	type FileKind,
	fileKindOf,
	fileTypeLabel,
	formatFileSize,
	isImageMime,
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

const t = createTranslator(mediaMessages);

const FILE_ICONS: Record<FileKind, typeof FileText> = { pdf: FileType, archive: FileArchive, text: FileText };

/** 이미지는 썸네일, 그 밖의 파일은 형식 아이콘. */
export function MediaThumb({ media, iconClassName }: { media: MediaItem; iconClassName?: string }) {
	if (!isImageMime(media.mimeType)) {
		const Icon = FILE_ICONS[fileKindOf(media.mimeType)];
		return <Icon className={cn("text-cms-muted-foreground", iconClassName)} aria-hidden />;
	}
	if (!media.publicUrl) return <File className={cn("text-cms-muted-foreground", iconClassName)} aria-hidden />;
	// biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic
	return <img src={media.publicUrl} alt="" loading="lazy" className="h-full w-full object-cover" />;
}

export interface MediaViewProps {
	items: readonly MediaItem[];
	/** 오른쪽 상세 칸에 열린 파일. `OPEN_ITEM`으로 강조한다. */
	selectedId: string | null;
	/** 조건을 바꾸는 동안 이전 줄을 흐리게 보인다. */
	dimmed: boolean;
	onSelect: (media: MediaItem) => void;
	menuFor: (media: MediaItem) => MenuAction[];
	/** Delete 키. 쓰이지 않는 파일만 삭제할 수 있다. */
	onDeleteKey: (media: MediaItem) => void;
}

const deleteKey = (media: MediaItem, onDeleteKey: (media: MediaItem) => void) => (event: KeyboardEvent) => {
	if (event.key === "Delete" && media.referencesCount === 0) {
		event.preventDefault();
		onDeleteKey(media);
	}
};

/** 바둑판 보기. 썸네일과 사용 여부를 크게 보인다. */
export function MediaGrid({ items, selectedId, dimmed, onSelect, menuFor, onDeleteKey }: MediaViewProps) {
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
							{isImageMime(media.mimeType) ? (
								<MediaThumb media={media} iconClassName="size-10" />
							) : (
								<span className="flex flex-col items-center gap-1.5 text-cms-muted-foreground">
									<MediaThumb media={media} iconClassName="size-10" />
									<span className="font-medium text-[10px]">{fileTypeLabel(media.filename, media.mimeType)}</span>
								</span>
							)}
							<Badge variant="secondary" className="absolute top-1.5 left-1.5 text-[10px]">
								{usageLabel(media)}
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

/** 목록 보기. 이름·형식·크기·치수·사용 여부·올린 날짜를 한 줄씩 보인다. */
export function MediaTable({ items, selectedId, dimmed, onSelect, menuFor, onDeleteKey }: MediaViewProps) {
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
								{isImageMime(media.mimeType)
									? (media.mimeType?.replace("image/", "").toUpperCase() ?? "—")
									: fileTypeLabel(media.filename, media.mimeType)}
							</TableCell>
							<TableCell className="tabular-nums">{formatFileSize(media.byteSize ?? 0)}</TableCell>
							<TableCell className="text-cms-muted-foreground tabular-nums">
								{media.width && media.height ? `${media.width}×${media.height}` : "—"}
							</TableCell>
							<TableCell>{usageLabel(media)}</TableCell>
							<TableCell className="text-cms-muted-foreground tabular-nums">
								{formatDateTime(media.createdAt, { dateStyle: "medium", timeStyle: "short" })}
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
