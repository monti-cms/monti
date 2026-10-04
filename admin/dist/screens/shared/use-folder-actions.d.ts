import type { Folder } from "@monti-cms/core/runtime";
import type { MenuAction } from "./action-menu.js";
/** Parent candidates to move to, excluding `folder` and its descendants. The server also rejects cycles. */
export declare function moveTargetsFor(folder: Folder, folders: Folder[]): Folder[];
/**
 * Right-click / `⋯` menu of a folder. The sidebar tree and the list's folder rows use the same menu.
 * Move targets are folders excluding itself and its descendants.
 */
export declare function folderMenuActions(folder: Folder, folders: Folder[], actions: FolderActions): MenuAction[];
/**
 * Virtual folder create, rename, move and delete. The sidebar tree and the list's folder rows share the same state and dialogs.
 * Delete proceeds after previewing the contents. Posts and child folders directly inside move to the parent, and posts are not deleted.
 */
export declare function useFolderActions({ collection, folders, onChanged, }: {
    collection: string;
    folders: Folder[];
    onChanged: (deletedId?: string) => Promise<void> | void;
}): {
    requestCreate: (parentId: string | null) => void;
    requestRename: (folder: Folder) => void;
    requestDelete: (folder: Folder) => Promise<void>;
    moveFolder: (folder: Folder, parentId: string | null) => Promise<void>;
    dialogs: import("react").JSX.Element;
};
export type FolderActions = Pick<ReturnType<typeof useFolderActions>, "requestCreate" | "requestRename" | "requestDelete" | "moveFolder">;
