import type { Folder } from "@monti-cms/core/site";
import { type FolderActions } from "./shared/use-folder-actions.js";
export declare function EntriesTableFolderRows({ explorer, folders, folderActions, visibleCount, onSelectFolder, }: {
    explorer: {
        folders: Folder[];
        parent: string | null;
    };
    folders: Folder[];
    folderActions?: FolderActions;
    /** Number of cells in a row, counted including empty ones. */
    visibleCount: number;
    onSelectFolder: (folder: string) => void;
}): import("react").JSX.Element;
