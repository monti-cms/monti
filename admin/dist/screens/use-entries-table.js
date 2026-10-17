import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { columnOrderingFeature, columnResizingFeature, columnSizingFeature, columnVisibilityFeature, createColumnHelper, rowSelectionFeature, tableFeatures, useTable, } from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState } from "react";
import { commonMessages } from "../lib/common.messages.js";
import { Button } from "../ui/button.js";
import { Checkbox } from "../ui/checkbox.js";
import { ColumnHeader } from "./column-header.js";
import { EntryCell } from "./entries-table-cells.js";
import { DEFAULT_TITLE_SIZE, defaultColumnSize, hideOrderWhenNarrow, MAX_COLUMN_SIZE, MIN_COLUMN_SIZE, TITLE_MIN_WIDTH, } from "./entries-table-widths.js";
import { columnsFor, filterFor, knownColumnRecord } from "./list-columns.js";
import { screensMessages } from "./messages.js";
import { MoreActionsButton } from "./shared/action-menu.js";
import { useDebouncedCallback } from "./shared/use-debounced.js";
// Data Table: TanStack Table handles column visibility/order and row selection; the server handles search, sort, filter and paging.
const features = tableFeatures({
    columnVisibilityFeature,
    columnOrderingFeature,
    columnSizingFeature,
    columnResizingFeature,
    rowSelectionFeature,
});
const helper = createColumnHelper();
const resolve = (updater, current) => typeof updater === "function" ? updater(current) : updater;
export function useEntriesTable({ collection, items, folders, explorer, state, options, onStateChange, columnSettings, onColumnSettingsChange, selectedIds, onSelectionChange, mode, rowMenu, onOpenRecord, onRestore, onPermanentDelete, }) {
    const site = useSite();
    const t = useTranslator(screensMessages);
    const tc = useTranslator(commonMessages);
    const isTrash = mode === "trash";
    const isRecord = site.isItemCollection(collection);
    const { available, defaults } = columnsFor(site, collection);
    // Drop saved-setting columns that no longer exist (deleted fields etc.).
    const savedOrder = (columnSettings?.order ?? []).filter((column) => available.includes(column));
    const savedVisibility = knownColumnRecord(columnSettings?.visibility, available);
    const order = [...new Set([...savedOrder, ...defaults, ...available])];
    const visibility = Object.fromEntries(available.map((column) => [column, column === "title" || (savedVisibility?.[column] ?? defaults.includes(column))]));
    // When viewed flat without folder separation (search, filters, include subfolders) and the folder column is off, append the folder path small next to the title.
    const showFolderBesideTitle = !explorer && !isTrash && !isRecord && folders.length > 0 && visibility.folder === false;
    // TanStack Table expects column definitions not to be recreated every render. Rebuild only when the values the cells read change.
    const availableKey = available.join();
    // biome-ignore lint/correctness/useExhaustiveDependencies: `availableKey` stands in for the contents of `available`
    const columns = useMemo(() => {
        return helper.columns([
            helper.display({
                id: "select",
                size: 44,
                enableResizing: false,
                header: ({ table }) => (_jsx(Checkbox, { checked: table.getIsAllPageRowsSelected(), indeterminate: table.getIsSomePageRowsSelected(), onCheckedChange: (value) => table.toggleAllPageRowsSelected(value === true), "aria-label": t("list.selectAll") })),
                cell: ({ row }) => (_jsx(Checkbox, { checked: row.getIsSelected(), onCheckedChange: (value) => row.toggleSelected(value === true), "aria-label": t("list.rowSelect", { title: row.original.title ?? tc("untitled") }) })),
            }),
            ...available.map((column) => helper.display({
                id: column,
                enableHiding: column !== "title",
                size: defaultColumnSize(site, collection, column),
                minSize: MIN_COLUMN_SIZE,
                maxSize: MAX_COLUMN_SIZE,
                header: () => (_jsx(ColumnHeader, { column: column, filter: filterFor(site, collection, column, mode), state: state, options: options, onChange: onStateChange })),
                cell: ({ row }) => (_jsx(EntryCell, { collection: collection, column: column, item: row.original, folders: folders, isTrash: isTrash, isRecord: isRecord, showFolderBesideTitle: showFolderBesideTitle, onOpenRecord: onOpenRecord })),
            })),
            helper.display({
                id: "actions",
                size: 52,
                enableResizing: false,
                header: () => _jsx("span", { className: "sr-only", children: t("list.actions") }),
                cell: ({ row }) => (_jsxs("div", { className: "flex items-center justify-end gap-1 whitespace-nowrap", children: [isTrash && (_jsxs(_Fragment, { children: [_jsx(Button, { type: "button", variant: "ghost", size: "xs", onClick: () => onRestore?.(row.original), children: tc("lifecycle.restore") }), _jsx(Button, { type: "button", variant: "ghost", size: "xs", className: "text-monti-destructive", onClick: () => onPermanentDelete?.(row.original), children: tc("lifecycle.deletePermanently") })] })), _jsx(MoreActionsButton, { actions: rowMenu(row.original), label: t("list.rowActions", { title: row.original.title ?? tc("untitled") }) })] })),
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
    ]);
    const rowSelection = Object.fromEntries([...selectedIds].map((id) => [id, true]));
    const columnOrder = ["select", ...order, "actions"];
    // While dragging, reflect straight into local state; when it stops, save to list settings.
    // biome-ignore lint/correctness/useExhaustiveDependencies: `availableKey` stands in for the contents of `available`
    const savedSizes = useMemo(() => knownColumnRecord(columnSettings?.sizes, available), [columnSettings?.sizes, availableKey]);
    const [columnSizing, setColumnSizing] = useState(savedSizes ?? {});
    useEffect(() => setColumnSizing(savedSizes ?? {}), [savedSizes]);
    const persistSizes = useDebouncedCallback((next) => {
        const sizes = Object.fromEntries(Object.entries(next)
            .filter(([id]) => available.includes(id))
            .map(([id, size]) => [id, Math.round(Math.min(MAX_COLUMN_SIZE, Math.max(MIN_COLUMN_SIZE, size)))]));
        onColumnSettingsChange({ order, visibility, sizes });
    }, 400);
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
    const defaultSizeOf = (id) => id === "select" ? 44 : id === "actions" ? 52 : defaultColumnSize(site, collection, id);
    const visibleIds = columnOrder.filter((id) => visibility[id] !== false);
    const autoHidden = new Set();
    const naturalWidth = () => visibleIds
        .filter((id) => !autoHidden.has(id))
        .reduce((sum, id) => sum + (id === "title" ? TITLE_MIN_WIDTH : defaultSizeOf(id)), 0);
    if (containerWidth > 0) {
        for (const id of hideOrderWhenNarrow(site, collection, available)) {
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
    return {
        table,
        order,
        visibility,
        scrollRef,
        isShown,
        tableWidth,
        visibleCount,
        tableSizing,
        freezeTitle,
        updateSizing,
        moveColumn,
    };
}
