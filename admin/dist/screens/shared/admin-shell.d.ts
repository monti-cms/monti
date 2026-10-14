import { type ReactNode } from "react";
import { type AdminSidebarProps } from "../admin-sidebar.js";
interface AdminNavContextValue {
    /** Number of trash items across all collections. null before loading. */
    trashCount: number | null;
    refreshTrashCount: () => void;
    /** Number of failed and dead event deliveries. null before loading or when unavailable. */
    eventsCount: number | null;
    /** How many folders each collection has (a collection whose folders are not loaded yet is missing). The sidebar shows a chevron for a collection that has some. */
    folderCounts: Readonly<Record<string, number>>;
}
/**
 * Puts a page's action buttons (the one primary action, such as "Add template") on the right of the title bar. The page decides what they are, because they
 * depend on its state; the shell only provides the place. Renders nothing until the title bar is mounted.
 */
export declare function PageActions({ children }: {
    children: ReactNode;
}): import("react").ReactPortal | null;
/**
 * A page inside the admin frame: the sidebar with `nav` active, `title` in the title bar, and the page below. The generic form of the pages that
 * only wrap a screen (event log, API keys, templates, a plugin's page); a page's own actions go in the title bar through {@link PageActions}.
 */
export declare function ShellPage({ title, nav, count, bare, children, }: {
    title: ReactNode;
    /** The sidebar item to mark as current (`events`, `tools:<path>`, ...). */
    nav: AdminSidebarProps["activeNav"];
    count?: number;
    bare?: boolean;
    children: ReactNode;
}): import("react").JSX.Element;
/** Recomputes the sidebar trash badge (call after moving to trash, restoring or permanent delete). */
export declare const useAdminNav: () => AdminNavContextValue;
/** Trash badge state. The screen's list logic must update this value too, so it lives outside the shell. */
export declare function AdminNavProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
/**
 * Frame shared by the list, media, templates and trash screens. Left is the shadcn Sidebar (a sheet on narrow screens),
 * with the screen title at the top right. On narrow screens, a header button opens the sidebar sheet.
 */
export declare function AdminShell({ title, count, sidebar, bare, children, }: {
    title: ReactNode;
    /** Item count shown dimmed next to the title. */
    count?: number;
    sidebar: AdminSidebarProps;
    /** The screen draws its own page header (the Settings page): the shell then has no title bar of its own. */
    bare?: boolean;
    children: ReactNode;
}): import("react").JSX.Element;
export {};
