"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { fileKindOf, fileTypeLabel, formatFileSize, useSite, useTranslator } from "@monti-cms/core/site";
import { File, FileArchive, FileText, FileType, Folder as FolderIcon, FolderOpen, FolderUp } from "lucide-react";
import { commonMessages } from "../../lib/common.messages.js";
import { cn } from "../../lib/utils/cn.js";
import { Badge } from "../../ui/badge.js";
import { Button } from "../../ui/button.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table.js";
import { folderKeyHandler } from "../admin-sidebar.js";
import { EntriesTableFolderRows } from "../entries-table-folder-rows.js";
import { screensMessages } from "../messages.js";
import { ActionContextMenu, MoreActionsButton } from "../shared/action-menu.js";
import { writeDraggedEntries } from "../shared/entry-drag.js";
import { formatDateTime } from "../shared/format-date.js";
import { OPEN_ITEM } from "../shared/side-panel.js";
import { folderMenuActions } from "../shared/use-folder-actions.js";
import { usageLabel } from "./media-item.js";
import { mediaMessages } from "./messages.js";
const FILE_ICONS = { pdf: FileType, archive: FileArchive, text: FileText };
/** Thumbnail for images, a type icon for other files. */
export function MediaThumb({ media, iconClassName }) {
    const site = useSite();
    if (!site.api.isImageType(media.mimeType)) {
        const Icon = FILE_ICONS[fileKindOf(media.mimeType)];
        return _jsx(Icon, { className: cn("text-monti-muted-foreground", iconClassName), "aria-hidden": true });
    }
    if (!media.publicUrl)
        return _jsx(File, { className: cn("text-monti-muted-foreground", iconClassName), "aria-hidden": true });
    return _jsx("img", { src: media.publicUrl, alt: "", loading: "lazy", className: "h-full w-full object-cover" });
}
const deleteKey = (media, onDeleteKey) => (event) => {
    if (event.key === "Delete" && media.referencesCount === 0) {
        event.preventDefault();
        onDeleteKey(media);
    }
};
/** Grid view. Shows the thumbnail and usage state large. */
export function MediaGrid({ items, selectedId, dimmed, onSelect, menuFor, onDeleteKey, explorer, folders, folderActions, onSelectFolder, }) {
    const site = useSite();
    const t = useTranslator(mediaMessages);
    const tc = useTranslator(commonMessages);
    const ts = useTranslator(screensMessages);
    const folderRowMenu = (folder) => folderActions
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
    return (_jsxs("ul", { className: cn("grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6", dimmed && "opacity-60"), children: [explorer?.parent !== null && explorer?.parent !== undefined && onSelectFolder && (_jsx("li", { className: "relative", children: _jsxs(Button, { variant: "outline", type: "button", onClick: () => onSelectFolder(explorer.parent ?? "all"), className: "h-auto w-full flex-col items-stretch gap-0 overflow-hidden rounded-lg bg-monti-card p-0 text-left font-normal hover:border-monti-foreground/30", children: [_jsx("span", { className: "relative flex aspect-square items-center justify-center bg-monti-muted/50 text-monti-muted-foreground hover:text-monti-foreground", children: _jsx(FolderUp, { className: "size-10", "aria-hidden": true }) }), _jsx("span", { className: "truncate p-2 font-medium text-monti-muted-foreground text-xs", children: ts("list.folderUp") })] }) })), explorer?.folders.map((folder) => {
                const actions = folderRowMenu(folder);
                return (_jsxs(ActionContextMenu, { actions: actions, trigger: _jsx("li", { className: "relative" }), children: [_jsxs(Button, { variant: "outline", type: "button", onClick: () => onSelectFolder?.(folder.id), onKeyDown: folderActions ? folderKeyHandler(folder, folderActions) : undefined, className: "h-auto w-full flex-col items-stretch gap-0 overflow-hidden rounded-lg bg-monti-card p-0 text-left font-normal hover:border-monti-foreground/30", children: [_jsx("span", { className: "relative flex aspect-square items-center justify-center bg-monti-muted/50 text-monti-muted-foreground", children: _jsx(FolderIcon, { className: "size-10 text-monti-muted-foreground", "aria-hidden": true }) }), _jsx("span", { className: "truncate p-2 font-medium text-xs", children: folder.name })] }), _jsx(MoreActionsButton, { actions: actions, label: ts("list.folderActions", { name: folder.name }), className: "absolute top-1 right-1 size-7 bg-monti-background/80" })] }, `folder-${folder.id}`));
            }), items.map((media) => (_jsxs(ActionContextMenu, { actions: menuFor(media), trigger: _jsx("li", { className: "relative" }), children: [_jsxs(Button, { variant: "outline", type: "button", draggable: true, onDragStart: (event) => writeDraggedEntries(event, [{ id: media.id, expectedVersion: 0 }], media.filename), "aria-current": selectedId === media.id ? "true" : undefined, onClick: () => onSelect(media), onKeyDown: deleteKey(media, onDeleteKey), className: cn("h-auto w-full flex-col items-stretch gap-0 overflow-hidden rounded-lg bg-monti-card p-0 text-left font-normal", selectedId === media.id
                            ? cn(OPEN_ITEM, "border-monti-foreground/40 hover:bg-monti-accent")
                            : "hover:border-monti-foreground/30"), children: [_jsxs("span", { className: "relative flex aspect-square items-center justify-center bg-monti-muted", children: [site.api.isImageType(media.mimeType) ? (_jsx(MediaThumb, { media: media, iconClassName: "size-10" })) : (_jsxs("span", { className: "flex flex-col items-center gap-1.5 text-monti-muted-foreground", children: [_jsx(MediaThumb, { media: media, iconClassName: "size-10" }), _jsx("span", { className: "font-medium text-[10px]", children: fileTypeLabel(media.filename, media.mimeType) })] })), _jsx(Badge, { variant: "secondary", className: "absolute top-1.5 left-1.5 text-[10px]", children: usageLabel(t, media) })] }), _jsx("span", { className: "truncate p-2 text-xs", children: media.filename })] }), _jsx(MoreActionsButton, { actions: menuFor(media), label: t("views.itemActions", { name: media.filename }), className: "absolute top-1 right-1 size-7 bg-monti-background/80" })] }, media.id)))] }));
}
/** List view. Shows name, type, size, dimensions, usage state and upload date, one per row. */
export function MediaTable({ items, selectedId, dimmed, onSelect, menuFor, onDeleteKey, explorer, folders, folderActions, onSelectFolder, }) {
    const site = useSite();
    const t = useTranslator(mediaMessages);
    return (_jsxs(Table, { "aria-label": t("views.table"), containerClassName: "overflow-visible", className: cn("table-fixed text-xs transition-opacity [&_td:first-child]:pl-4 lg:[&_td:first-child]:pl-6 [&_td:last-child]:pr-4 lg:[&_td:last-child]:pr-6 [&_th:first-child]:pl-4 lg:[&_th:first-child]:pl-6 [&_th:last-child]:pr-4 lg:[&_th:last-child]:pr-6", dimmed && "opacity-60"), children: [_jsx(TableHeader, { className: "sticky top-0 z-10 bg-monti-background [&_tr]:border-b", children: _jsxs(TableRow, { children: [_jsx(TableHead, { className: "w-14 font-normal text-monti-muted-foreground", children: _jsx("span", { className: "sr-only", children: t("views.preview") }) }), _jsx(TableHead, { className: "font-normal text-monti-muted-foreground", children: t("views.filename") }), _jsx(TableHead, { className: "w-28 font-normal text-monti-muted-foreground", children: t("views.type") }), _jsx(TableHead, { className: "w-24 font-normal text-monti-muted-foreground", children: t("views.size") }), _jsx(TableHead, { className: "w-28 font-normal text-monti-muted-foreground", children: t("views.dimensions") }), _jsx(TableHead, { className: "w-20 font-normal text-monti-muted-foreground", children: t("views.usage") }), _jsx(TableHead, { className: "w-40 font-normal text-monti-muted-foreground", children: t("views.uploadedAt") }), _jsx(TableHead, { className: "w-10 font-normal text-monti-muted-foreground", children: _jsx("span", { className: "sr-only", children: t("views.actions") }) })] }) }), _jsxs(TableBody, { children: [explorer && folders && onSelectFolder && (_jsx(EntriesTableFolderRows, { explorer: explorer, folders: folders, folderActions: folderActions, visibleCount: 8, onSelectFolder: onSelectFolder })), items.map((media) => {
                        const isSelected = selectedId === media.id;
                        return (_jsxs(ActionContextMenu, { actions: menuFor(media), trigger: _jsx(TableRow, { "aria-current": isSelected ? "true" : undefined, className: cn("cursor-pointer", isSelected && OPEN_ITEM), draggable: true, onDragStart: (event) => writeDraggedEntries(event, [{ id: media.id, expectedVersion: 0 }], media.filename), onClick: () => onSelect(media) }), children: [_jsx(TableCell, { className: "py-1.5", children: _jsx("span", { className: "flex size-9 items-center justify-center overflow-hidden rounded border bg-monti-muted", children: _jsx(MediaThumb, { media: media, iconClassName: "size-4" }) }) }), _jsx(TableCell, { className: "max-w-0", children: _jsx("button", { type: "button", "aria-current": isSelected ? "true" : undefined, onClick: (event) => {
                                            event.stopPropagation();
                                            onSelect(media);
                                        }, onKeyDown: deleteKey(media, onDeleteKey), className: "block w-full truncate text-left font-medium outline-none hover:underline focus-visible:underline", children: media.filename }) }), _jsx(TableCell, { className: "text-monti-muted-foreground", children: site.api.isImageType(media.mimeType)
                                        ? (media.mimeType?.replace("image/", "").toUpperCase() ?? "—")
                                        : fileTypeLabel(media.filename, media.mimeType) }), _jsx(TableCell, { className: "tabular-nums", children: formatFileSize(media.byteSize ?? 0) }), _jsx(TableCell, { className: "text-monti-muted-foreground tabular-nums", children: media.width && media.height ? `${media.width}×${media.height}` : "—" }), _jsx(TableCell, { children: usageLabel(t, media) }), _jsx(TableCell, { className: "text-monti-muted-foreground tabular-nums", children: formatDateTime(site, media.createdAt, { dateStyle: "medium", timeStyle: "short" }) }), _jsx(TableCell, { onClick: (event) => event.stopPropagation(), children: _jsx(MoreActionsButton, { actions: menuFor(media), label: t("views.itemActions", { name: media.filename }), className: "size-7" }) })] }, media.id));
                    })] })] }));
}
