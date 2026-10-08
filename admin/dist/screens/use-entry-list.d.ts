import type { CollectionPreferences } from "@monti-cms/core/client";
import type { Folder, ListEntriesItem } from "@monti-cms/core/runtime";
import { type BulkItemResult, type BulkSelection, runBulk } from "./entries/bulk-bar.js";
import { type BulkParams } from "./list-row-menu.js";
import { type ListState } from "./list-state.js";
import type { RecordTarget } from "./record-panel.js";
import type { MenuAction } from "./shared/action-menu.js";
import type { DraggedEntry } from "./shared/entry-drag.js";
import { type OptimisticOp } from "./shared/list-cache.js";
export type ListMode = "list" | "trash";
/**
 * State, data and actions of the list and trash screens. Draws no UI pieces.
 * Shared by the sidebar folder navigation (list screen) and the body.
 */
export declare function useEntryList(mode: ListMode): {
    mode: ListMode;
    state: ListState;
    update: (patch: Partial<ListState>, options?: {
        resetPage?: boolean;
    }) => void;
    label: string;
    options: Readonly<Record<string, readonly import("./shared/use-taxonomy.js").TaxonomyOption[]>>;
    columnSettings: {
        order?: string[] | undefined;
        visibility?: Record<string, boolean> | undefined;
        sizes?: Record<string, number> | undefined;
    } | undefined;
    savePreferences: (patch: CollectionPreferences) => void;
    data: {
        folders: Folder[];
        apiQuery: string;
        listKey: readonly ["cms", "entries", "list", string];
        items: ListEntriesItem[];
        total: number;
        errorMessage: string | null;
        isLoading: boolean;
        isRefreshing: boolean;
        retry: () => undefined;
    };
    explorer: {
        folders: Folder[];
        parent: string | null;
    } | null;
    selectedIds: Set<string>;
    setSelectedIds: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
    mutations: {
        mutateEntries: (op: OptimisticOp, targets: BulkSelection[], request: () => Promise<BulkItemResult[]>, params?: BulkParams) => Promise<BulkItemResult[]>;
        bulk: (op: Parameters<typeof runBulk>[1], label: string, targets: BulkSelection[], params?: BulkParams) => Promise<void>;
        restore: (targets: BulkSelection[]) => Promise<void>;
        invalidateEntries: () => Promise<void>;
    };
    folderActions: {
        requestCreate: (parentId: string | null) => void;
        requestRename: (folder: Folder) => void;
        requestDelete: (folder: Folder) => Promise<void>;
        moveFolder: (folder: Folder, parentId: string | null) => Promise<void>;
        dialogs: import("react").JSX.Element;
    };
    recordTarget: RecordTarget | null;
    openRecord: (target: RecordTarget) => Promise<void>;
    showRecord: (target: RecordTarget) => void;
    closeRecord: () => void;
    setRecordDirty: (dirty: boolean) => void;
    /** Confirm dialogs of this list (move to trash, archive, permanent delete, discard changes). Render once per screen. */
    confirmDialog: import("react").JSX.Element;
    reloadTaxonomies: () => undefined;
    invalidateEntries: () => Promise<void>;
    moveEntries: (folderId: string | null, entries: DraggedEntry[]) => undefined;
    createNew: () => void;
    rowMenu: (item: ListEntriesItem) => MenuAction[];
    onDeleteKey: (item: ListEntriesItem) => void;
    restore: (targets: BulkSelection[]) => Promise<void>;
    confirmPermanentDelete: (targets: BulkSelection[]) => undefined;
};
export type EntryList = ReturnType<typeof useEntryList>;
