import { type Collection } from "@monti-cms/core/client";
import type { Folder } from "@monti-cms/core/runtime";
import { type KeyboardEvent } from "react";
import { type DraggedEntry } from "./shared/entry-drag.js";
import { type FolderActions } from "./shared/use-folder-actions.js";
/** Value that points to the current screen in the sidebar. Every Settings tab is the one `settings` entry; a plugin page is `tools:<path>`. */
export type AdminNavId = Collection | "media" | "templates" | "api-keys" | "events" | "settings" | "trash" | `tools:${string}`;
/** Folder navigation, passed by the list screen. The sidebar draws it as a tree under the collection it belongs to. */
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
    /** Failed and dead event deliveries: shown on the Event log entry. */
    eventsCount?: number | null;
    /** Folders per collection, so a collection that has some shows a chevron even while it is not the open one. */
    folderCounts?: Readonly<Record<string, number>>;
}
/** Like a file explorer: F2 opens rename, Delete opens delete (confirm dialog). */
export declare function folderKeyHandler(folder: Folder, actions: FolderActions): (event: KeyboardEvent) => void;
/** Left navigation area: Content (collections with their folders, media), Tools (templates, plugin pages, API keys, event log), Trash, and Settings with the theme toggle pinned at the bottom. */
export declare function AdminSidebar({ activeNav, folderNav, trashCount, eventsCount, folderCounts }: AdminSidebarProps): import("react").JSX.Element;
