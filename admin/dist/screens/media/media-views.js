"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { fileKindOf, fileTypeLabel, formatFileSize, useSite, useTranslator, } from "@monti-cms/core/client";
import { File, FileArchive, FileText, FileType } from "lucide-react";
import { cn } from "../../lib/utils/cn.js";
import { Badge } from "../../ui/badge.js";
import { Button } from "../../ui/button.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table.js";
import { ActionContextMenu, MoreActionsButton } from "../shared/action-menu.js";
import { formatDateTime } from "../shared/format-date.js";
import { OPEN_ITEM } from "../shared/side-panel.js";
import { usageLabel } from "./media-item.js";
import { mediaMessages } from "./messages.js";
const FILE_ICONS = { pdf: FileType, archive: FileArchive, text: FileText };
/** Thumbnail for images, a type icon for other files. */
export function MediaThumb({ media, iconClassName }) {
    const site = useSite();
    if (!site.api.isImageMime(media.mimeType)) {
        const Icon = FILE_ICONS[fileKindOf(media.mimeType)];
        return _jsx(Icon, { className: cn("text-cms-muted-foreground", iconClassName), "aria-hidden": true });
    }
    if (!media.publicUrl)
        return _jsx(File, { className: cn("text-cms-muted-foreground", iconClassName), "aria-hidden": true });
    // biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic
    return _jsx("img", { src: media.publicUrl, alt: "", loading: "lazy", className: "h-full w-full object-cover" });
}
const deleteKey = (media, onDeleteKey) => (event) => {
    if (event.key === "Delete" && media.referencesCount === 0) {
        event.preventDefault();
        onDeleteKey(media);
    }
};
/** Grid view. Shows the thumbnail and usage state large. */
export function MediaGrid({ items, selectedId, dimmed, onSelect, menuFor, onDeleteKey }) {
    const site = useSite();
    const t = useTranslator(mediaMessages);
    return (_jsx("ul", { className: cn("grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6", dimmed && "opacity-60"), children: items.map((media) => (_jsxs(ActionContextMenu, { actions: menuFor(media), trigger: _jsx("li", { className: "relative" }), children: [_jsxs(Button, { variant: "outline", type: "button", "aria-current": selectedId === media.id ? "true" : undefined, onClick: () => onSelect(media), onKeyDown: deleteKey(media, onDeleteKey), className: cn("h-auto w-full flex-col items-stretch gap-0 overflow-hidden rounded-lg bg-cms-card p-0 text-left font-normal", selectedId === media.id
                        ? cn(OPEN_ITEM, "border-cms-foreground/40 hover:bg-cms-accent")
                        : "hover:border-cms-foreground/30"), children: [_jsxs("span", { className: "relative flex aspect-square items-center justify-center bg-cms-muted", children: [site.api.isImageMime(media.mimeType) ? (_jsx(MediaThumb, { media: media, iconClassName: "size-10" })) : (_jsxs("span", { className: "flex flex-col items-center gap-1.5 text-cms-muted-foreground", children: [_jsx(MediaThumb, { media: media, iconClassName: "size-10" }), _jsx("span", { className: "font-medium text-[10px]", children: fileTypeLabel(media.filename, media.mimeType) })] })), _jsx(Badge, { variant: "secondary", className: "absolute top-1.5 left-1.5 text-[10px]", children: usageLabel(t, media) })] }), _jsx("span", { className: "truncate p-2 text-xs", children: media.filename })] }), _jsx(MoreActionsButton, { actions: menuFor(media), label: t("views.itemActions", { name: media.filename }), className: "absolute top-1 right-1 size-7 bg-cms-background/80" })] }, media.id))) }));
}
/** List view. Shows name, type, size, dimensions, usage state and upload date, one per row. */
export function MediaTable({ items, selectedId, dimmed, onSelect, menuFor, onDeleteKey }) {
    const site = useSite();
    const t = useTranslator(mediaMessages);
    return (_jsxs(Table, { "aria-label": t("views.table"), className: cn("text-xs transition-opacity", dimmed && "opacity-60"), children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { className: "w-12", children: _jsx("span", { className: "sr-only", children: t("views.preview") }) }), _jsx(TableHead, { children: t("views.filename") }), _jsx(TableHead, { className: "w-28", children: t("views.type") }), _jsx(TableHead, { className: "w-24", children: t("views.size") }), _jsx(TableHead, { className: "w-28", children: t("views.dimensions") }), _jsx(TableHead, { className: "w-20", children: t("views.usage") }), _jsx(TableHead, { className: "w-40", children: t("views.uploadedAt") }), _jsx(TableHead, { className: "w-10", children: _jsx("span", { className: "sr-only", children: t("views.actions") }) })] }) }), _jsx(TableBody, { children: items.map((media) => {
                    const isSelected = selectedId === media.id;
                    return (_jsxs(ActionContextMenu, { actions: menuFor(media), trigger: _jsx(TableRow, { "aria-current": isSelected ? "true" : undefined, className: cn("cursor-pointer", isSelected && OPEN_ITEM), onClick: () => onSelect(media) }), children: [_jsx(TableCell, { className: "py-1.5", children: _jsx("span", { className: "flex size-9 items-center justify-center overflow-hidden rounded border bg-cms-muted", children: _jsx(MediaThumb, { media: media, iconClassName: "size-4" }) }) }), _jsx(TableCell, { className: "max-w-0", children: _jsx("button", { type: "button", "aria-current": isSelected ? "true" : undefined, onClick: (event) => {
                                        event.stopPropagation();
                                        onSelect(media);
                                    }, onKeyDown: deleteKey(media, onDeleteKey), className: "block w-full truncate text-left font-medium outline-none hover:underline focus-visible:underline", children: media.filename }) }), _jsx(TableCell, { className: "text-cms-muted-foreground", children: site.api.isImageMime(media.mimeType)
                                    ? (media.mimeType?.replace("image/", "").toUpperCase() ?? "—")
                                    : fileTypeLabel(media.filename, media.mimeType) }), _jsx(TableCell, { className: "tabular-nums", children: formatFileSize(media.byteSize ?? 0) }), _jsx(TableCell, { className: "text-cms-muted-foreground tabular-nums", children: media.width && media.height ? `${media.width}×${media.height}` : "—" }), _jsx(TableCell, { children: usageLabel(t, media) }), _jsx(TableCell, { className: "text-cms-muted-foreground tabular-nums", children: formatDateTime(site, media.createdAt, { dateStyle: "medium", timeStyle: "short" }) }), _jsx(TableCell, { onClick: (event) => event.stopPropagation(), children: _jsx(MoreActionsButton, { actions: menuFor(media), label: t("views.itemActions", { name: media.filename }), className: "size-7" }) })] }, media.id));
                }) })] }));
}
