import type { CollectionPreferences, Folder, ListEntriesItem } from "@monti-cms/core/site";
import { type BulkSelection } from "../api/entries.js";
import { type ListState } from "./list-state.js";
import type { MenuAction } from "./shared/action-menu.js";
import type { DraggedEntry } from "./shared/entry-drag.js";
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
    /**
     * The folders of this list and what can be done with them; `null` where the list shows no folders (a collection without folders, the trash).
     * Every folder entry point (the sidebar tree, folder rows, the blank-area and row menus, the bulk move, dropping rows on a folder) reads this,
     * so none of them can offer folders the server would refuse.
     */
    folders: {
        list: Folder[];
        actions: {
            requestCreate: (parentId: string | null) => void;
            requestRename: (folder: Folder) => void;
            requestDelete: (folder: Folder) => void;
            moveFolder: (folder: Folder, parentId: string | null) => void;
            createFolderDirect: (name: string, parentId: string | null) => Promise<void>;
            renameFolderDirect: (folder: Folder, newName: string) => Promise<void>;
            dialogs: import("react").JSX.Element;
        };
        moveEntries: (folderId: string | null, entries: DraggedEntry[]) => undefined;
    } | null;
    /** The folder dialogs (create, rename, delete). Render once per screen; they open only through `folders.actions`. */
    folderDialogs: import("react").JSX.Element;
    explorer: {
        folders: Folder[];
        parent: string | null;
    } | null;
    selectedIds: Set<string>;
    setSelectedIds: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
    mutations: {
        run: (op: import("./shared/list-cache.js").OptimisticOp, targets: BulkSelection[], params?: import("../api/entries.js").BulkParams) => Promise<import("../api/entries.js").BulkItemResult[]>;
        bulk: (op: import("@monti-cms/core/site").BulkOp, label: string, targets: BulkSelection[], params?: import("../api/entries.js").BulkParams) => Promise<void>;
        restore: (targets: BulkSelection[]) => Promise<void>;
        invalidateEntries: () => Promise<void>;
    };
    recordTarget: import("./record-panel.js").RecordTarget | null;
    openRecord: (target: import("./record-panel.js").RecordTarget) => Promise<void>;
    showRecord: (target: import("./record-panel.js").RecordTarget) => void;
    closeRecord: () => void;
    setRecordDirty: (dirty: boolean) => void;
    /** Confirm dialogs of this list (move to trash, archive, permanent delete, discard changes). Render once per screen. */
    confirmDialog: import("react").JSX.Element;
    /** The discard dialog of a link clicked while the panel has changes. Render once per screen. */
    guardDialog: import("react").ReactNode;
    reloadTaxonomies: () => undefined;
    invalidateEntries: () => Promise<void>;
    createNew: () => void;
    rowMenu: (item: ListEntriesItem) => MenuAction[];
    onDeleteKey: (item: ListEntriesItem) => void;
    restore: (targets: BulkSelection[]) => Promise<void>;
    confirmPermanentDelete: (targets: BulkSelection[]) => undefined;
};
export type EntryList = ReturnType<typeof useEntryList>;
