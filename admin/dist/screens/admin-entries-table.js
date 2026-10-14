"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { Inbox, Plus, SearchX, Trash2 } from "lucide-react";
import { Fragment } from "react";
import { commonMessages } from "../lib/common.messages.js";
import { cn } from "../lib/utils/cn.js";
import { Skeleton } from "../ui/skeleton.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table.js";
import { ColumnResizeHandle } from "./column-resize-handle.js";
import { ColumnSettingsPopover } from "./entries-table-column-settings.js";
import { EntriesTableFolderRows } from "./entries-table-folder-rows.js";
import { MAX_COLUMN_SIZE, MIN_COLUMN_SIZE } from "./entries-table-widths.js";
import { columnConfig, columnLabel } from "./list-columns.js";
import { clearFiltersPatch, isFiltered } from "./list-state.js";
import { screensMessages } from "./messages.js";
import { ActionContextMenu } from "./shared/action-menu.js";
import { EmptyState } from "./shared/empty-state.js";
import { writeDraggedEntries } from "./shared/entry-drag.js";
import { ListPagination } from "./shared/list-pager.js";
import { LoadErrorAlert } from "./shared/load-error-alert.js";
import { OPEN_ITEM } from "./shared/side-panel.js";
import { useEntriesTable } from "./use-entries-table.js";
export function AdminEntriesTable({ collection, items, folders, explorer, state, options, onStateChange, columnSettings, onColumnSettingsChange, selectedIds, onSelectionChange, total, isLoading, isRefreshing = false, errorMessage, mode = "list", folderActions, rowMenu, blankMenu, onDeleteKey, onSelectFolder, onOpenRecord, openRecordId = null, onRestore, onPermanentDelete, onPageChange, onPageSizeChange, onRetry, addAction, }) {
    const site = useSite();
    const t = useTranslator(screensMessages);
    const tc = useTranslator(commonMessages);
    const isTrash = mode === "trash";
    const { table, order, visibility, scrollRef, isShown, tableWidth, visibleCount, tableSizing, freezeTitle, updateSizing, moveColumn, } = useEntriesTable({
        collection,
        items,
        folders,
        explorer,
        state,
        options,
        onStateChange,
        columnSettings,
        onColumnSettingsChange,
        selectedIds,
        onSelectionChange,
        mode,
        rowMenu,
        onOpenRecord,
        onRestore,
        onPermanentDelete,
    });
    const rowKeyDown = (item) => (event) => {
        if (event.key !== "Delete" || !onDeleteKey)
            return;
        const target = event.target;
        if (target.closest("input, textarea, [contenteditable=true]"))
            return;
        event.preventDefault();
        onDeleteKey(item);
    };
    const pageHref = (page) => `?page=${page}`;
    return (_jsxs("section", { "aria-label": t("list.label"), className: "flex min-h-0 flex-1 flex-col overflow-hidden", children: [errorMessage && _jsx(LoadErrorAlert, { message: errorMessage, onRetry: onRetry, className: "mx-5 mt-3" }), _jsxs("div", { ref: scrollRef, className: "flex min-h-0 flex-1 flex-col overflow-auto", children: [_jsxs(Table, { containerClassName: "overflow-visible", style: tableWidth ? { width: tableWidth } : undefined, className: "table-fixed [&_td:first-child]:pl-5 [&_td:last-child]:pr-4 [&_th:first-child]:pl-5 [&_th:last-child]:pr-4", children: [_jsx(TableHeader, { className: "sticky top-0 z-10 bg-cms-background [&_tr]:border-b", children: table.getHeaderGroups().map((group) => (_jsx(TableRow, { children: group.headers
                                        .filter((header) => isShown(header.column.id))
                                        .map((header) => {
                                        const sortField = columnConfig(site, collection, header.column.id).sortField;
                                        const active = sortField !== undefined && sortField === state.sortField;
                                        return (_jsxs(Fragment, { children: [header.column.id === "actions" && _jsx(TableHead, { "aria-hidden": true, className: "p-0" }), _jsxs(TableHead, { style: { width: header.getSize() }, className: cn("group/th relative h-9 font-normal text-cms-muted-foreground text-xs", header.column.id === "select" && "w-10"), "aria-sort": active ? (state.sortDirection === "asc" ? "ascending" : "descending") : undefined, children: [header.isPlaceholder ? null : _jsx(table.FlexRender, { header: header }), header.column.getCanResize() && (_jsx(ColumnResizeHandle, { label: columnLabel(site, collection, header.column.id), width: header.getSize(), resizing: header.column.getIsResizing(), onStart: (event) => {
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
                                    }) }, group.id))) }), _jsxs(TableBody, { "aria-busy": isRefreshing || undefined, className: cn("transition-opacity", isRefreshing && "opacity-60"), children: [explorer && (_jsx(EntriesTableFolderRows, { explorer: explorer, folders: folders, folderActions: folderActions, visibleCount: visibleCount, onSelectFolder: onSelectFolder })), isLoading
                                        ? Array.from({ length: 5 }, (_, index) => (_jsx(TableRow, { "aria-hidden": true, children: _jsx(TableCell, { colSpan: visibleCount, children: _jsx(Skeleton, { className: "h-5 w-full" }) }) }, index)))
                                        : items.length === 0
                                            ? null
                                            : table.getRowModel().rows.map((row) => (_jsx(ActionContextMenu, { actions: rowMenu(row.original), trigger: _jsx(TableRow, { className: cn("h-11 data-[state=selected]:bg-cms-primary/5", row.original.id === openRecordId && OPEN_ITEM), "aria-current": row.original.id === openRecordId ? "true" : undefined, "data-state": row.getIsSelected() ? "selected" : undefined, draggable: !isTrash, onDragStart: (event) => {
                                                        // Dragging a selected row moves the whole selection; otherwise just this row.
                                                        const group = selectedIds.has(row.original.id)
                                                            ? items.filter((item) => selectedIds.has(item.id))
                                                            : [row.original];
                                                        writeDraggedEntries(event, group.map((item) => ({ id: item.id, expectedVersion: item.version })), group.length === 1
                                                            ? group[0]?.title || tc("untitled")
                                                            : t("list.itemsCount", { count: group.length }));
                                                    }, onKeyDown: rowKeyDown(row.original) }), children: row
                                                    .getVisibleCells()
                                                    .filter((cell) => isShown(cell.column.id))
                                                    .map((cell) => (_jsxs(Fragment, { children: [cell.column.id === "actions" && _jsx(TableCell, { "aria-hidden": true, className: "p-0" }), _jsx(TableCell, { className: "overflow-hidden text-ellipsis whitespace-nowrap", children: _jsx(table.FlexRender, { cell: cell }) })] }, cell.id))) }, row.id)))] })] }), !isLoading &&
                        !errorMessage &&
                        items.length === 0 &&
                        !explorer?.folders.length &&
                        (isTrash ? (_jsx(EmptyState, { icon: Trash2, title: t("list.emptyTrash") })) : isFiltered(state) ? (_jsx(EmptyState, { icon: SearchX, title: t("list.emptyNoMatch"), description: t("list.emptyNoMatchHint"), action: { label: t("list.clearFilters"), onClick: () => onStateChange(clearFiltersPatch(state)) } })) : (_jsx(EmptyState, { icon: Inbox, title: t("list.emptyYet"), description: t("list.emptyYetHint"), action: addAction && { label: addAction.label, icon: Plus, onClick: addAction.run } }))), blankMenu && (_jsx(ActionContextMenu, { actions: blankMenu, trigger: _jsx("div", { className: "min-h-12 flex-1", "aria-hidden": true }) }))] }), _jsx(ListPagination, { total: total, shown: items.length, page: state.page, pageSize: state.pageSize, onPageChange: onPageChange, onPageSizeChange: onPageSizeChange, hrefFor: pageHref, leading: _jsx(ColumnSettingsPopover, { collection: collection, order: order, visibility: visibility, onToggle: (column, visible) => table.getColumn(column)?.toggleVisibility(visible), onMove: moveColumn }) })] }));
}
