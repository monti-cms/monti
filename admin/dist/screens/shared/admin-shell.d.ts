import { type ReactNode } from "react";
import { type AdminSidebarProps } from "../admin-sidebar.js";
interface AdminNavContextValue {
    /** Number of trash items across all collections. null before loading. */
    trashCount: number | null;
    refreshTrashCount: () => void;
    /** Number of failed and dead event deliveries. null before loading or when unavailable. */
    eventsCount: number | null;
}
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
export declare function AdminShell({ title, count, sidebar, headerActions, children, }: {
    title: ReactNode;
    /** Item count shown dimmed next to the title. */
    count?: number;
    sidebar: AdminSidebarProps;
    headerActions?: ReactNode;
    children: ReactNode;
}): import("react").JSX.Element;
export {};
