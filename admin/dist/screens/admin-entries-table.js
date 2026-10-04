"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { adminEntryEditHref, createTranslator, isItemCollection, LOCALES, localeLabel, PAGE_SIZES, } from "@monti-cms/core/client";
import { columnOrderingFeature, columnResizingFeature, columnSizingFeature, columnVisibilityFeature, createColumnHelper, rowSelectionFeature, tableFeatures, useTable, } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Columns3, Folder as FolderIcon, FolderOpen, FolderUp } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useCmsAdminComponents } from "../admin-components.js";
import { cn } from "../lib/utils/cn.js";
import { Alert, AlertDescription } from "../ui/alert.js";
import { Button } from "../ui/button.js";
import { Checkbox } from "../ui/checkbox.js";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../ui/empty.js";
import { IconButton } from "../ui/icon-button.js";
import { Label } from "../ui/label.js";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../ui/pagination.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";
import { Skeleton } from "../ui/skeleton.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table.js";
import { folderKeyHandler } from "./admin-sidebar.js";
import { ColumnHeader } from "./column-header.js";
import { customListCell, DefaultFieldCell } from "./list-cells.js";
import { columnConfig, columnLabel, columnsFor, fieldColumnOf, filterFor, knownColumnRecord, } from "./list-columns.js";
import { screensMessages } from "./messages.js";
import { ActionContextMenu, MoreActionsButton } from "./shared/action-menu.js";
import { writeDraggedEntries } from "./shared/entry-drag.js";
import { describeEntryStatus, STATUS_LABELS } from "./shared/entry-status.js";
import { formatDateOnly, formatDateTime, zonedYear } from "./shared/format-date.js";
import { OPEN_ITEM } from "./shared/side-panel.js";
import { folderMenuActions } from "./shared/use-folder-actions.js";
const t = createTranslator(screensMessages);
export { columnsFor };
// Data Table: TanStack Table handles column visibility/order and row selection; the server handles search, sort, filter and paging.
const features = tableFeatures({
    columnVisibilityFeature,
    columnOrderingFeature,
    columnSizingFeature,
    columnResizingFeature,
    rowSelectionFeature,
});
/**
 * Default column widths (px). Title fills the remaining width if unset. Dragging to change it saves that value.
 * A taxonomy field column is wide enough for chips if it is a many-relation (tags etc.), or for a single name if single (category etc.).
 */
const DEFAULT_COLUMN_SIZE = {
    status: 132,
    locale: 124,
    updatedAt: 132,
    publishedAt: 132,
    createdAt: 132,
    slug: 200,
    folder: 140,
};
const DEFAULT_TITLE_SIZE = 320;
const MANY_RELATION_SIZE = 200;
const SINGLE_RELATION_SIZE = 112;
const SELECT_SIZE = 132;
const TEXT_SIZE = 200;
function defaultColumnSize(collection, column) {
    const size = DEFAULT_COLUMN_SIZE[column];
    if (size !== undefined)
        return size;
    const config = columnConfig(collection, column);
    const kind = fieldColumnOf(collection, column)?.field.kind;
    if (kind === "relation")
        return config.many ? MANY_RELATION_SIZE : SINGLE_RELATION_SIZE;
    if (kind === "select")
        return SELECT_SIZE;
    if (kind === "text" || kind === "media")
        return TEXT_SIZE;
    return DEFAULT_TITLE_SIZE;
}
const MIN_COLUMN_SIZE = 72;
const MAX_COLUMN_SIZE = 960;
const helper = createColumnHelper();
/** List date: this year as `9월 27일 14:05`, otherwise short like `2025. 8. 7.`. The exact time is in the edit screen, not a tooltip. */
const formatDate = (value) => {
    if (!value)
        return "—";
    const sameYear = zonedYear(value) === zonedYear(Date.now());
    return sameYear
        ? formatDateTime(value, { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
        : formatDateOnly(value);
};
/**
 * Columns hidden first when width runs short, and their order. Even user-enabled columns are hidden in this order if the title cannot get its minimum width.
 * Many-relation taxonomy field columns (tags etc.) are hidden last. Title, status, single taxonomy fields (category etc.) and updated date are never hidden.
 */
const HIDE_ORDER_WHEN_NARROW = ["folder", "slug", "createdAt", "publishedAt", "locale"];
const hideOrderWhenNarrow = (collection, available) => [
    ...HIDE_ORDER_WHEN_NARROW,
    ...available.filter((column) => columnConfig(collection, column).many),
];
const TITLE_MIN_WIDTH = 240;
/**
 * Column width resize handle. Drag the header's right edge, or focus it and press ←/→ to change by 16px. Pressing twice resets to the default width.
 */
function ColumnResizeHandle({ label, width, resizing, onStart, onNudge, onReset, }) {
    return (_jsx("div", { role: "separator", "aria-orientation": "vertical", "aria-label": t("list.resizeColumn", { label }), "aria-valuenow": width, "aria-valuemin": MIN_COLUMN_SIZE, "aria-valuemax": MAX_COLUMN_SIZE, "aria-valuetext": `${width}px`, tabIndex: 0, onMouseDown: onStart, onTouchStart: onStart, onDoubleClick: onReset, onKeyDown: (event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                onNudge(event.key === "ArrowLeft" ? -16 : 16);
            }
        }, className: "absolute top-0 right-0 z-10 flex h-full w-2 cursor-col-resize touch-none select-none justify-center outline-none", children: _jsx("span", { className: cn("h-full w-px bg-transparent transition-colors group-hover/th:bg-cms-border", resizing && "bg-cms-primary group-hover/th:bg-cms-primary", "[div:focus-visible>&]:bg-cms-ring") }) }));
}
const BADGE_CLASS = "inline-flex h-5 items-center rounded border px-1.5 font-medium text-[11px] leading-none";
const BADGE_TONE = {
    published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 cms-dark:text-emerald-400",
    changed: "border-amber-500/30 bg-amber-500/10 text-amber-700 cms-dark:text-amber-400",
    draft: "border-amber-500/30 bg-amber-500/10 text-amber-700 cms-dark:text-amber-400",
    archived: "border-transparent bg-cms-muted text-cms-muted-foreground",
};
/** Per-locale status of a translation group. Existing locales link to their edit screen; missing ones show only as dashed. Status is also readable as text, not just color. */
function LocaleBadges({ translations }) {
    return (_jsx("span", { className: "flex items-center gap-1", children: LOCALES.map((locale) => {
            const name = localeLabel(locale);
            const member = translations.find((candidate) => candidate.locale === locale);
            if (!member) {
                return (_jsxs("span", { className: cn(BADGE_CLASS, "border-dashed text-cms-muted-foreground/70"), children: [_jsx("span", { "aria-hidden": "true", children: locale.toUpperCase() }), _jsx("span", { className: "sr-only", children: t("locale.hasNot", { name }) })] }, locale));
            }
            const tone = member.status === "published"
                ? member.hasUnpublishedChanges
                    ? "changed"
                    : "published"
                : member.status === "draft"
                    ? "draft"
                    : "archived";
            return (_jsxs(Link, { href: adminEntryEditHref(member.id), className: cn(BADGE_CLASS, BADGE_TONE[tone], "cms-dark:hover:brightness-125 hover:brightness-95"), children: [_jsx("span", { "aria-hidden": "true", children: locale.toUpperCase() }), _jsxs("span", { className: "sr-only", children: [name, " \u00B7 ", STATUS_LABELS[member.status]] })] }, locale));
        }) }));
}
/** Locales of a taxonomy item (category, tag, series). Locales with a name are filled badges, others are dashed badges. */
function RecordLocaleBadges({ locales }) {
    return (_jsx("span", { className: "flex items-center gap-1", children: LOCALES.map((locale) => {
            const named = locales.includes(locale);
            return (_jsxs("span", { className: cn(BADGE_CLASS, named ? BADGE_TONE.published : "border-dashed text-cms-muted-foreground/70"), children: [_jsx("span", { "aria-hidden": "true", children: locale.toUpperCase() }), _jsx("span", { className: "sr-only", children: t(named ? "locale.has" : "locale.hasNot", { name: localeLabel(locale) }) })] }, locale));
        }) }));
}
/** Shows status with both icon shape and text (not conveyed by color alone). */
function StatusLabel({ item, isRecord }) {
    const label = isRecord && item.status === "published" ? t("list.statusActive") : describeEntryStatus(item);
    const tone = item.status === "published"
        ? item.hasUnpublishedChanges
            ? "text-amber-600 cms-dark:text-amber-400"
            : "text-emerald-600 cms-dark:text-emerald-400"
        : "text-cms-muted-foreground";
    const icon = item.status === "published" ? (item.hasUnpublishedChanges ? (_jsxs(_Fragment, { children: [_jsx("circle", { cx: "8", cy: "8", r: "5.5" }), _jsx("path", { d: "M8 2.5a5.5 5.5 0 0 1 0 11z", fill: "currentColor", stroke: "none" })] })) : (_jsx("circle", { cx: "8", cy: "8", r: "5.5", fill: "currentColor", stroke: "none" }))) : item.status === "archived" || item.status === "trashed" ? (_jsxs(_Fragment, { children: [_jsx("circle", { cx: "8", cy: "8", r: "5.5" }), _jsx("path", { d: "M5 8h6" })] })) : (_jsx("circle", { cx: "8", cy: "8", r: "5.5", strokeDasharray: "2.4 2.4" }));
    return (_jsxs("span", { className: "inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-cms-foreground/80", children: [_jsx("svg", { "aria-hidden": "true", focusable: "false", viewBox: "0 0 16 16", className: cn("size-3.5 shrink-0", tone), fill: "none", stroke: "currentColor", strokeWidth: "1.6", children: icon }), label] }));
}
const resolve = (updater, current) => typeof updater === "function" ? updater(current) : updater;
export function AdminEntriesTable({ collection, items, folders, explorer, state, options, onStateChange, columnSettings, onColumnSettingsChange, selectedIds, onSelectionChange, total, isLoading, isRefreshing = false, errorMessage, mode = "list", folderActions, rowMenu, blankMenu, onDeleteKey, onSelectFolder, onOpenRecord, openRecordId = null, onRestore, onPermanentDelete, onPageChange, onPageSizeChange, onRetry, }) {
    const isTrash = mode === "trash";
    const isRecord = isItemCollection(collection);
    const { listCells } = useCmsAdminComponents();
    const { available, defaults } = columnsFor(collection);
    // Drop saved-setting columns that no longer exist (deleted fields etc.).
    const savedOrder = (columnSettings?.order ?? []).filter((column) => available.includes(column));
    const savedVisibility = knownColumnRecord(columnSettings?.visibility, available);
    const order = [...new Set([...savedOrder, ...defaults, ...available])];
    const visibility = Object.fromEntries(available.map((column) => [column, column === "title" || (savedVisibility?.[column] ?? defaults.includes(column))]));
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    /** Folder path from the top level, like `상위 / 하위`. `—` for items outside folders. */
    const folderName = (id) => {
        const names = [];
        let folder = id ? folders.find((candidate) => candidate.id === id) : undefined;
        while (folder && names.length < 8) {
            names.unshift(folder.name);
            const parentId = folder.parentId;
            folder = parentId ? folders.find((candidate) => candidate.id === parentId) : undefined;
        }
        return names.length > 0 ? names.join(" / ") : "—";
    };
    // When viewed flat without folder separation (search, filters, include subfolders) and the folder column is off, append the folder path small next to the title.
    const showFolderBesideTitle = !explorer && !isTrash && !isRecord && folders.length > 0 && visibility.folder === false;
    // TanStack Table expects column definitions not to be recreated every render. Rebuild only when the values the cells read change.
    const availableKey = available.join();
    // biome-ignore lint/correctness/useExhaustiveDependencies: `availableKey` stands in for the contents of `available`
    const columns = useMemo(() => {
        const cell = (item, column) => {
            switch (column) {
                case "title": {
                    const title = item.title || _jsx("span", { className: "text-cms-muted-foreground italic", children: t("common.untitled") });
                    if (isTrash)
                        return _jsx("span", { className: "font-medium", children: title });
                    return isRecord ? (_jsx(Button, { type: "button", variant: "link", size: "sm", onClick: () => onOpenRecord(item), className: "h-auto p-0 font-medium text-cms-foreground hover:text-cms-primary", children: title })) : (_jsxs("span", { className: "flex min-w-0 items-center gap-2", children: [_jsx(Link, { href: adminEntryEditHref(item.id), className: "truncate font-medium text-cms-foreground hover:text-cms-primary", children: title }), showFolderBesideTitle && item.folderId && (_jsxs("span", { className: "flex min-w-0 shrink items-center gap-1 text-cms-muted-foreground text-xs", children: [_jsx(FolderIcon, { "aria-hidden": true, className: "size-3 shrink-0" }), _jsxs("span", { className: "truncate", children: [_jsx("span", { className: "sr-only", children: t("list.folderSr") }), folderName(item.folderId)] })] }))] }));
                }
                case "status":
                    // Do not convey status by color alone.
                    return _jsx(StatusLabel, { item: item, isRecord: isRecord });
                case "locale":
                    if (item.recordLocales)
                        return _jsx(RecordLocaleBadges, { locales: item.recordLocales });
                    if (item.translations)
                        return _jsx(LocaleBadges, { translations: item.translations });
                    // Also mark that a translation is not the original.
                    return (_jsxs("span", { className: "text-cms-muted-foreground text-xs", children: [_jsx("abbr", { title: localeLabel(item.locale), className: "font-medium no-underline", children: item.locale.toUpperCase() }), item.translationGroupId !== item.id && _jsx("span", { className: "ml-1", children: t("list.translation") })] }));
                case "updatedAt":
                case "createdAt":
                case "publishedAt":
                    return (_jsx("span", { className: "tabular whitespace-nowrap text-cms-muted-foreground text-xs", children: formatDate(item[column]) }));
                case "slug":
                    return _jsx("span", { className: "font-mono text-cms-muted-foreground text-xs", children: item.slug || "—" });
                case "folder":
                    return _jsx("span", { className: "text-cms-muted-foreground text-xs", children: folderName(item.folderId) });
                default:
                    // Field columns: default cells for relations (including taxonomy fields), select and text.
                    return _jsx(DefaultFieldCell, { collection: collection, column: column, entry: item });
            }
        };
        // Cells registered by admin extensions (`listCells`) take precedence over default cells.
        const cellOf = (item, column) => {
            const Custom = customListCell(listCells, collection, column);
            if (!Custom)
                return cell(item, column);
            const stored = fieldColumnOf(collection, column);
            return (_jsx(Custom, { collection: collection, column: column, field: stored?.field, entry: item, value: stored ? item.values[column] : undefined }));
        };
        return helper.columns([
            helper.display({
                id: "select",
                size: 44,
                enableResizing: false,
                header: ({ table }) => (_jsx(Checkbox, { checked: table.getIsAllPageRowsSelected(), indeterminate: table.getIsSomePageRowsSelected(), onCheckedChange: (value) => table.toggleAllPageRowsSelected(value === true), "aria-label": t("list.selectAll") })),
                cell: ({ row }) => (_jsx(Checkbox, { checked: row.getIsSelected(), onCheckedChange: (value) => row.toggleSelected(value === true), "aria-label": t("list.rowSelect", { title: row.original.title ?? t("common.untitled") }) })),
            }),
            ...available.map((column) => helper.display({
                id: column,
                enableHiding: column !== "title",
                size: defaultColumnSize(collection, column),
                minSize: MIN_COLUMN_SIZE,
                maxSize: MAX_COLUMN_SIZE,
                header: () => (_jsx(ColumnHeader, { column: column, filter: filterFor(collection, column, mode), state: state, options: options, onChange: onStateChange })),
                cell: ({ row }) => cellOf(row.original, column),
            })),
            helper.display({
                id: "actions",
                size: 52,
                enableResizing: false,
                header: () => _jsx("span", { className: "sr-only", children: t("list.actions") }),
                cell: ({ row }) => (_jsxs("div", { className: "flex items-center justify-end gap-1 whitespace-nowrap", children: [isTrash && (_jsxs(_Fragment, { children: [_jsx(Button, { type: "button", variant: "ghost", size: "xs", onClick: () => onRestore?.(row.original), children: t("list.restore") }), _jsx(Button, { type: "button", variant: "ghost", size: "xs", className: "text-cms-destructive", onClick: () => onPermanentDelete?.(row.original), children: t("list.permanentDelete") })] })), _jsx(MoreActionsButton, { actions: rowMenu(row.original), label: t("list.rowActions", { title: row.original.title ?? t("common.untitled") }) })] })),
            }),
        ]);
    }, [
        mode,
        availableKey,
        collection,
        state,
        options,
        onStateChange,
        isTrash,
        isRecord,
        folders,
        rowMenu,
        onOpenRecord,
        onRestore,
        onPermanentDelete,
        showFolderBesideTitle,
        listCells,
    ]);
    const rowSelection = Object.fromEntries([...selectedIds].map((id) => [id, true]));
    const columnOrder = ["select", ...order, "actions"];
    // While dragging, reflect straight into local state; when it stops, save to list settings.
    // biome-ignore lint/correctness/useExhaustiveDependencies: `availableKey` stands in for the contents of `available`
    const savedSizes = useMemo(() => knownColumnRecord(columnSettings?.sizes, available), [columnSettings?.sizes, availableKey]);
    const [columnSizing, setColumnSizing] = useState(savedSizes ?? {});
    useEffect(() => setColumnSizing(savedSizes ?? {}), [savedSizes]);
    const saveTimer = useRef(null);
    const persistSizes = (next) => {
        if (saveTimer.current)
            clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            const sizes = Object.fromEntries(Object.entries(next)
                .filter(([id]) => available.includes(id))
                .map(([id, size]) => [id, Math.round(Math.min(MAX_COLUMN_SIZE, Math.max(MIN_COLUMN_SIZE, size)))]));
            onColumnSettingsChange({ order, visibility, sizes });
        }, 400);
    };
    const updateSizing = (updater) => setColumnSizing((current) => {
        const next = resolve(updater, current);
        persistSizes(next);
        return next;
    });
    // Actual width of the scroll area. Table width and which columns to hide when narrow are decided from this.
    const scrollRef = useRef(null);
    const [containerWidth, setContainerWidth] = useState(0);
    useEffect(() => {
        const element = scrollRef.current;
        if (!element)
            return;
        setContainerWidth(element.clientWidth);
        if (typeof ResizeObserver === "undefined")
            return;
        const observer = new ResizeObserver(([entry]) => setContainerWidth(Math.floor(entry?.contentRect.width ?? 0)));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    // Columns to hide when narrow are decided only by default widths and the title's minimum width. User-widened widths do not trigger hiding and become horizontal scroll
    // (so handles don't jump when another column disappears mid-drag).
    const defaultSizeOf = (id) => id === "select" ? 44 : id === "actions" ? 52 : defaultColumnSize(collection, id);
    const visibleIds = columnOrder.filter((id) => visibility[id] !== false);
    const autoHidden = new Set();
    const naturalWidth = () => visibleIds
        .filter((id) => !autoHidden.has(id))
        .reduce((sum, id) => sum + (id === "title" ? TITLE_MIN_WIDTH : defaultSizeOf(id)), 0);
    if (containerWidth > 0) {
        for (const id of hideOrderWhenNarrow(collection, available)) {
            if (naturalWidth() <= containerWidth)
                break;
            if (visibleIds.includes(id))
                autoHidden.add(id);
        }
    }
    const isShown = (id) => !autoHidden.has(id);
    // Title fills the remaining width if no width is set. When any column starts dragging, pin the title's width at that moment,
    // so only the dragged column grows and the handle follows the cursor. Leftover width then goes to the spacer before the actions column.
    const flexTitleWidth = containerWidth > 0
        ? Math.min(MAX_COLUMN_SIZE, Math.max(TITLE_MIN_WIDTH, containerWidth -
            visibleIds
                .filter((id) => id !== "title" && isShown(id))
                .reduce((sum, id) => sum + (columnSizing[id] ?? defaultSizeOf(id)), 0)))
        : DEFAULT_TITLE_SIZE;
    const tableSizing = columnSizing.title === undefined ? { ...columnSizing, title: flexTitleWidth } : columnSizing;
    const freezeTitle = () => {
        if (columnSizing.title === undefined)
            setColumnSizing((current) => ({ ...current, title: flexTitleWidth }));
    };
    const table = useTable({
        features,
        data: items,
        columns,
        getRowId: (row) => row.id,
        columnResizeMode: "onChange",
        state: { columnVisibility: visibility, columnOrder, rowSelection, columnSizing: tableSizing },
        onColumnSizingChange: updateSizing,
        onColumnVisibilityChange: (updater) => onColumnSettingsChange({
            order,
            visibility: resolve(updater, visibility),
            sizes: savedSizes,
        }),
        onColumnOrderChange: (updater) => {
            const next = resolve(updater, columnOrder).filter((id) => available.includes(id));
            onColumnSettingsChange({ order: next, visibility, sizes: savedSizes });
        },
        // Deselection can arrive as a key with value false, so keep only IDs that are true.
        onRowSelectionChange: (updater) => {
            const next = resolve(updater, rowSelection);
            onSelectionChange(new Set(Object.entries(next).flatMap(([id, on]) => (on ? [id] : []))));
        },
    });
    const moveColumn = (column, direction) => {
        const index = order.indexOf(column);
        const target = index + direction;
        if (target < 0 || target >= order.length)
            return;
        const next = [...order];
        [next[index], next[target]] = [next[target], next[index]];
        onColumnSettingsChange({ order: next, visibility, sizes: savedSizes });
    };
    const leafColumns = table.getVisibleLeafColumns();
    const tableWidth = containerWidth > 0
        ? Math.max(containerWidth, leafColumns.filter((column) => isShown(column.id)).reduce((sum, column) => sum + column.getSize(), 0))
        : undefined;
    // Number of cells counted including empty ones.
    const visibleCount = leafColumns.length - autoHidden.size + 1;
    const rowKeyDown = (item) => (event) => {
        if (event.key !== "Delete" || !onDeleteKey)
            return;
        const target = event.target;
        if (target.closest("input, textarea, [contenteditable=true]"))
            return;
        event.preventDefault();
        onDeleteKey(item);
    };
    // Add `열기` to the same folder menu as the sidebar tree.
    const folderRowMenu = (folder) => folderActions
        ? [
            { kind: "item", label: t("list.folderOpen"), icon: FolderOpen, onSelect: () => onSelectFolder(folder.id) },
            { kind: "separator" },
            ...folderMenuActions(folder, folders, folderActions),
        ]
        : [];
    const pageHref = (page) => `?page=${page}`;
    return (_jsxs("section", { "aria-label": t("list.label"), className: "flex min-h-0 flex-1 flex-col overflow-hidden", children: [errorMessage && (_jsxs(Alert, { variant: "danger", className: "mx-5 mt-3 flex w-auto items-center justify-between", children: [_jsx(AlertDescription, { className: "col-start-auto", children: errorMessage }), _jsx(Button, { type: "button", variant: "outline", size: "xs", onClick: onRetry, children: t("common.retry") })] })), _jsxs("div", { ref: scrollRef, className: "flex min-h-0 flex-1 flex-col overflow-auto", children: [_jsxs(Table, { containerClassName: "overflow-visible", style: tableWidth ? { width: tableWidth } : undefined, className: "table-fixed [&_td:first-child]:pl-5 [&_td:last-child]:pr-4 [&_th:first-child]:pl-5 [&_th:last-child]:pr-4", children: [_jsx(TableHeader, { className: "sticky top-0 z-10 bg-cms-background [&_tr]:border-b", children: table.getHeaderGroups().map((group) => (_jsx(TableRow, { children: group.headers
                                        .filter((header) => isShown(header.column.id))
                                        .map((header) => {
                                        const sortField = columnConfig(collection, header.column.id).sortField;
                                        const active = sortField !== undefined && sortField === state.sortField;
                                        return (_jsxs(Fragment, { children: [header.column.id === "actions" && _jsx(TableHead, { "aria-hidden": true, className: "p-0" }), _jsxs(TableHead, { style: { width: header.getSize() }, className: cn("group/th relative h-9 font-normal text-cms-muted-foreground text-xs", header.column.id === "select" && "w-10"), "aria-sort": active ? (state.sortDirection === "asc" ? "ascending" : "descending") : undefined, children: [header.isPlaceholder ? null : _jsx(table.FlexRender, { header: header }), header.column.getCanResize() && (_jsx(ColumnResizeHandle, { label: columnLabel(collection, header.column.id), width: header.getSize(), resizing: header.column.getIsResizing(), onStart: (event) => {
                                                                freezeTitle();
                                                                header.getResizeHandler()(event);
                                                            }, onNudge: (delta) => updateSizing((current) => ({
                                                                ...tableSizing,
                                                                ...current,
                                                                [header.column.id]: Math.min(MAX_COLUMN_SIZE, Math.max(MIN_COLUMN_SIZE, header.getSize() + delta)),
                                                            })), onReset: () => updateSizing((current) => {
                                                                const { [header.column.id]: _removed, ...rest } = current;
                                                                return rest;
                                                            }) }))] })] }, header.id));
                                    }) }, group.id))) }), _jsxs(TableBody, { "aria-busy": isRefreshing || undefined, className: cn("transition-opacity", isRefreshing && "opacity-60"), children: [explorer && explorer.parent !== null && (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "text-center text-cms-muted-foreground", children: _jsx(FolderUp, { "aria-hidden": true, className: "mx-auto size-4" }) }), _jsx(TableCell, { colSpan: visibleCount - 1, children: _jsx(Button, { type: "button", variant: "link", size: "sm", onClick: () => onSelectFolder(explorer.parent ?? "all"), className: "h-auto p-0 text-cms-muted-foreground hover:text-cms-foreground", children: t("list.folderUp") }) })] })), explorer?.folders.map((folder) => (_jsxs(ActionContextMenu, { actions: folderRowMenu(folder), trigger: _jsx(TableRow, {}), children: [_jsx(TableCell, { className: "text-center text-cms-muted-foreground", children: _jsx(FolderIcon, { "aria-hidden": true, className: "mx-auto size-4" }) }), _jsx(TableCell, { colSpan: visibleCount - 2, className: "font-medium", children: _jsx(Button, { type: "button", variant: "link", size: "sm", onClick: () => onSelectFolder(folder.id), onKeyDown: folderActions ? folderKeyHandler(folder, folderActions) : undefined, className: "h-auto p-0 font-medium text-cms-foreground", children: folder.name }) }), _jsx(TableCell, { className: "text-right", children: _jsx(MoreActionsButton, { actions: folderRowMenu(folder), label: t("list.folderActions", { name: folder.name }) }) })] }, `folder-${folder.id}`))), isLoading ? (Array.from({ length: 5 }, (_, index) => (_jsx(TableRow, { "aria-hidden": true, children: _jsx(TableCell, { colSpan: visibleCount, children: _jsx(Skeleton, { className: "h-5 w-full" }) }) }, index)))) : items.length === 0 && !explorer?.folders.length ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: visibleCount, className: "p-0", children: _jsx(Empty, { className: "py-10", children: _jsxs(EmptyHeader, { children: [_jsx(EmptyTitle, { children: isTrash ? t("list.emptyTrash") : t("list.emptyNone") }), !isTrash && _jsx(EmptyDescription, { children: t("list.emptyHint") })] }) }) }) })) : (table.getRowModel().rows.map((row) => (_jsx(ActionContextMenu, { actions: rowMenu(row.original), trigger: _jsx(TableRow, { className: cn("h-11 data-[state=selected]:bg-cms-primary/5", row.original.id === openRecordId && OPEN_ITEM), "aria-current": row.original.id === openRecordId ? "true" : undefined, "data-state": row.getIsSelected() ? "selected" : undefined, draggable: !isTrash, onDragStart: (event) => {
                                                // Dragging a selected row moves the whole selection; otherwise just this row.
                                                const group = selectedIds.has(row.original.id)
                                                    ? items.filter((item) => selectedIds.has(item.id))
                                                    : [row.original];
                                                writeDraggedEntries(event, group.map((item) => ({ id: item.id, expectedVersion: item.version })), group.length === 1
                                                    ? group[0]?.title || t("common.untitled")
                                                    : t("list.itemsCount", { count: group.length }));
                                            }, onKeyDown: rowKeyDown(row.original) }), children: row
                                            .getVisibleCells()
                                            .filter((cell) => isShown(cell.column.id))
                                            .map((cell) => (_jsxs(Fragment, { children: [cell.column.id === "actions" && _jsx(TableCell, { "aria-hidden": true, className: "p-0" }), _jsx(TableCell, { className: "overflow-hidden text-ellipsis whitespace-nowrap", children: _jsx(table.FlexRender, { cell: cell }) })] }, cell.id))) }, row.id))))] })] }), blankMenu && (_jsx(ActionContextMenu, { actions: blankMenu, trigger: _jsx("div", { className: "min-h-12 flex-1", "aria-hidden": true }) }))] }), _jsxs("div", { className: "flex h-12 shrink-0 items-center justify-between gap-3 border-t px-5 text-cms-muted-foreground text-xs", children: [_jsx("span", { className: "tabular", children: t("list.range", {
                            total,
                            range: items.length > 0
                                ? `${(state.page - 1) * state.pageSize + 1}–${Math.min(state.page * state.pageSize, total)}`
                                : "0",
                        }) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Popover, { children: [_jsxs(PopoverTrigger, { render: _jsx(Button, { type: "button", variant: "ghost", size: "xs", className: "text-cms-muted-foreground" }), children: [_jsx(Columns3, { "aria-hidden": true }), t("list.columnSettings")] }), _jsx(PopoverContent, { align: "end", className: "w-64 p-3", children: _jsx("ul", { className: "space-y-1", children: order.map((column, index) => (_jsxs("li", { className: "flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-cms-accent", children: [_jsxs(Label, { className: "font-normal", children: [_jsx(Checkbox, { checked: visibility[column] ?? false, disabled: column === "title", onCheckedChange: (checked) => table.getColumn(column)?.toggleVisibility(checked === true) }), columnLabel(collection, column)] }), _jsxs("span", { className: "flex gap-1", children: [_jsx(IconButton, { size: "icon-xs", variant: "outline", label: t("list.columnUp", { label: columnLabel(collection, column) }), disabled: index === 0, onClick: () => moveColumn(column, -1), children: _jsx(ArrowUp, { "aria-hidden": true }) }), _jsx(IconButton, { size: "icon-xs", variant: "outline", label: t("list.columnDown", { label: columnLabel(collection, column) }), disabled: index === order.length - 1, onClick: () => moveColumn(column, 1), children: _jsx(ArrowDown, { "aria-hidden": true }) })] })] }, column))) }) })] }), _jsxs(Select, { value: String(state.pageSize), items: PAGE_SIZES.map((size) => ({ value: String(size), label: t("list.pageSizeOption", { size }) })), onValueChange: (value) => value && onPageSizeChange(Number(value)), children: [_jsx(SelectTrigger, { size: "sm", "aria-label": t("list.pageSize"), className: "h-7 border-0 text-xs shadow-none", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: PAGE_SIZES.map((size) => (_jsx(SelectItem, { value: String(size), children: t("list.pageSizeOption", { size }) }, size))) })] }), _jsx(Pagination, { className: "mx-0 w-auto", children: _jsxs(PaginationContent, { children: [_jsx(PaginationItem, { children: _jsx(PaginationPrevious, { href: pageHref(state.page - 1), "aria-disabled": state.page <= 1, className: cn(state.page <= 1 && "pointer-events-none opacity-50"), onClick: (event) => {
                                                    event.preventDefault();
                                                    if (state.page > 1)
                                                        onPageChange(state.page - 1);
                                                } }) }), _jsx(PaginationItem, { children: _jsxs("span", { className: "px-2 tabular-nums", children: [state.page, " / ", totalPages] }) }), _jsx(PaginationItem, { children: _jsx(PaginationNext, { href: pageHref(state.page + 1), "aria-disabled": state.page >= totalPages, className: cn(state.page >= totalPages && "pointer-events-none opacity-50"), onClick: (event) => {
                                                    event.preventDefault();
                                                    if (state.page < totalPages)
                                                        onPageChange(state.page + 1);
                                                } }) })] }) })] })] })] }));
}
