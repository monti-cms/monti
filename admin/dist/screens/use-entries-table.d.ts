import { type AdminColumnSettings } from "@monti-cms/core/client";
import type { Folder, ListEntriesItem } from "@monti-cms/core/runtime";
import { type ColumnSizingState, type ColumnVisibilityState, type Updater } from "@tanstack/react-table";
import { type AdminListColumn } from "./list-columns.js";
import type { ListState } from "./list-state.js";
import { type MenuAction } from "./shared/action-menu.js";
import type { TaxonomyOptions } from "./shared/use-taxonomy.js";
export declare function useEntriesTable({ collection, items, folders, explorer, state, options, onStateChange, columnSettings, onColumnSettingsChange, selectedIds, onSelectionChange, mode, rowMenu, onOpenRecord, onRestore, onPermanentDelete, }: {
    collection: string;
    items: ListEntriesItem[];
    folders: Folder[];
    explorer: {
        folders: Folder[];
        parent: string | null;
    } | null;
    state: ListState;
    options: TaxonomyOptions;
    onStateChange: (patch: Partial<ListState>) => void;
    columnSettings?: AdminColumnSettings;
    onColumnSettingsChange: (settings: AdminColumnSettings) => void;
    selectedIds: Set<string>;
    onSelectionChange: (ids: Set<string>) => void;
    mode: "list" | "trash";
    rowMenu: (item: ListEntriesItem) => MenuAction[];
    onOpenRecord: (item: ListEntriesItem) => void;
    onRestore?: (item: ListEntriesItem) => void;
    onPermanentDelete?: (item: ListEntriesItem) => void;
}): {
    table: import("@tanstack/react-table").ReactTable<{
        columnVisibilityFeature: import("@tanstack/react-table").TableFeature;
        columnOrderingFeature: import("@tanstack/react-table").TableFeature;
        columnSizingFeature: import("@tanstack/react-table").TableFeature;
        columnResizingFeature: import("@tanstack/react-table").TableFeature;
        rowSelectionFeature: import("@tanstack/react-table").TableFeature;
    }, ListEntriesItem, import("@tanstack/react-table").TableState_ColumnOrdering & import("@tanstack/react-table").TableState_ColumnResizing & import("@tanstack/react-table").TableState_ColumnSizing & import("@tanstack/react-table").TableState_ColumnVisibility & import("@tanstack/react-table").TableState_RowSelection>;
    order: string[];
    visibility: ColumnVisibilityState;
    scrollRef: import("react").RefObject<HTMLDivElement | null>;
    isShown: (id: string) => boolean;
    tableWidth: number | undefined;
    visibleCount: number;
    tableSizing: ColumnSizingState;
    freezeTitle: () => void;
    updateSizing: (updater: Updater<ColumnSizingState>) => void;
    moveColumn: (column: AdminListColumn, direction: -1 | 1) => void;
};
