import { type Collection } from "@monti-cms/core/client";
import type { Folder } from "@monti-cms/core/runtime";
import { type KeyboardEvent } from "react";
import { type DraggedEntry } from "./shared/entry-drag.js";
import { type FolderActions } from "./shared/use-folder-actions.js";
/** Value that points to the current screen in the sidebar. For a plugin screen, that screen's address (`nav.path`, e.g. `ai`). */
export type AdminNavId = Collection | "media" | "templates" | "trash" | (string & {});
/** Folder navigation used only on the list screen. */
export interface FolderNavigation {
    collection: Collection;
    /** `all` (top level) or a folder ID. */
    currentFolder: string;
    includeDescendants: boolean;
    folders: Folder[];
    folderActions: FolderActions;
    onSelectFolder: (folder: string) => void;
    onIncludeDescendantsChange: (value: boolean) => void;
    /** When a list row is dragged and dropped onto a folder (or the top level). */
    onDropEntries: (folderId: string | null, entries: DraggedEntry[]) => void;
    onCreateEntry: () => void;
}
export interface AdminSidebarProps {
    activeNav: AdminNavId;
    folderNav?: FolderNavigation;
    trashCount?: number | null;
}
/** Like a file explorer: F2 opens rename, Delete opens delete (confirm dialog). */
export declare function folderKeyHandler(folder: Folder, actions: FolderActions): (event: KeyboardEvent) => void;
/** Left navigation area: collections, media/templates/trash, virtual folder tree. */
export declare function AdminSidebar({ activeNav, folderNav, trashCount }: AdminSidebarProps): import("react").JSX.Element;
