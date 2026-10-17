import { type ReactNode } from "react";
import { type AdminSidebarProps } from "../admin-sidebar.js";
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
