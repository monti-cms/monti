import { type AdminColumnSettings, type PageSize, type Site } from "@monti-cms/core/client";
import type { Folder, ListEntriesItem } from "@monti-cms/core/runtime";
import { type AdminListColumn, columnsFor } from "./list-columns.js";
import type { ListState } from "./list-state.js";
import { type MenuAction } from "./shared/action-menu.js";
import { type FolderActions } from "./shared/use-folder-actions.js";
import type { TaxonomyOptions } from "./shared/use-taxonomy.js";
export { columnsFor };
/**
 * The post date (`publishedAt`) is the date a reader sees, so it goes last: after the locale and the many-relation columns. Hidden first, as it used to be, the list showed only
 * "Updated", which for imported posts is the day of the import.
 */
export declare const hideOrderWhenNarrow: (site: Site, collection: string, available: readonly AdminListColumn[]) => string[];
interface TableProps {
    collection: string;
    items: ListEntriesItem[];
    folders: Folder[];
    /** Subfolders and move-to-parent shown above the list in folder browse mode. */
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
    total: number;
    isLoading: boolean;
    /** Fetching a new list after conditions changed. Keeps the previous rows dimmed. */
    isRefreshing?: boolean;
    errorMessage: string | null;
    /** `trash` means the trash screen: no drag-move or folder browsing, and each row shows restore and permanent delete. */
    mode?: "list" | "trash";
    folderActions?: FolderActions;
    /** Right-click / `⋯` menu of a row. For a selected row, targets the whole selection. */
    rowMenu: (item: ListEntriesItem) => MenuAction[];
    /** Right-click menu on empty space in the list. */
    blankMenu?: MenuAction[];
    /** Delete key on a row. On the list it moves to trash; in trash it asks about permanent delete. */
    onDeleteKey?: (item: ListEntriesItem) => void;
    onSelectFolder: (folder: string) => void;
    onOpenRecord: (item: ListEntriesItem) => void;
    /** Item open in the right taxonomy edit slot. Highlights that row. */
    openRecordId?: string | null;
    onRestore?: (item: ListEntriesItem) => void;
    onPermanentDelete?: (item: ListEntriesItem) => void;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: PageSize) => void;
    onRetry: () => void;
}
export declare function AdminEntriesTable({ collection, items, folders, explorer, state, options, onStateChange, columnSettings, onColumnSettingsChange, selectedIds, onSelectionChange, total, isLoading, isRefreshing, errorMessage, mode, folderActions, rowMenu, blankMenu, onDeleteKey, onSelectFolder, onOpenRecord, openRecordId, onRestore, onPermanentDelete, onPageChange, onPageSizeChange, onRetry, }: TableProps): import("react").JSX.Element;
