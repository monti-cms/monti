"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../../ui/sidebar.js";
import { cmsFetch } from "../admin-api.js";
import { AdminSidebar } from "../admin-sidebar.js";
import { countFailedEvents, EVENTS_COUNT_KEY } from "../events/events-api.js";
import { fetchFolders, foldersKey, TRASH_COUNT_KEY } from "./list-cache.js";
import { sharedMessages } from "./messages.js";
const AdminNavContext = createContext(null);
/** The element on the right of the shell's title bar, where a page's own actions go (see {@link PageActions}). */
const ActionsSlotContext = createContext(null);
/**
 * Puts a page's action buttons (the one primary action, such as "Add template") on the right of the title bar. The page decides what they are, because they
 * depend on its state; the shell only provides the place. Renders nothing until the title bar is mounted.
 */
export function PageActions({ children }) {
    const slot = useContext(ActionsSlotContext);
    return slot ? createPortal(children, slot) : null;
}
/** Recomputes the sidebar trash badge (call after moving to trash, restoring or permanent delete). */
export const useAdminNav = () => useContext(AdminNavContext) ?? { trashCount: null, refreshTrashCount: () => { }, eventsCount: null, folderCounts: {} };
async function countTrash(site) {
    const totals = await Promise.all(site.COLLECTIONS.map(async (collection) => {
        const query = new URLSearchParams({ collection, status: "trashed", pageSize: "25" });
        const data = await cmsFetch(site, cmsApiUrl(`/v1/entries?${query.toString()}`));
        return data.total;
    }));
    return totals.reduce((sum, total) => sum + total, 0);
}
/** Trash badge state. The screen's list logic must update this value too, so it lives outside the shell. */
export function AdminNavProvider({ children }) {
    const site = useSite();
    const queryClient = useQueryClient();
    const { data } = useQuery({ queryKey: TRASH_COUNT_KEY, queryFn: () => countTrash(site) });
    // A light background fetch. Errors (for example no access) are ignored so the sidebar never breaks.
    const { data: eventsCount } = useQuery({
        queryKey: EVENTS_COUNT_KEY,
        queryFn: () => countFailedEvents(site),
        retry: false,
    });
    // The sidebar needs to know which collections have folders, not only the open one. The list screen reads the same cache entries.
    const folderCounts = useQueries({
        queries: site.COLLECTIONS.map((collection) => ({
            queryKey: foldersKey(collection),
            queryFn: ({ signal }) => fetchFolders(site, collection, signal),
            retry: false,
        })),
        combine: (results) => Object.fromEntries(site.COLLECTIONS.flatMap((collection, index) => {
            const folders = results[index]?.data;
            return folders ? [[collection, folders.length]] : [];
        })),
    });
    const folderKey = JSON.stringify(folderCounts);
    const refreshTrashCount = useCallback(() => void queryClient.invalidateQueries({ queryKey: TRASH_COUNT_KEY }), [queryClient]);
    // biome-ignore lint/correctness/useExhaustiveDependencies: `folderKey` is the stable identity of `folderCounts`
    const nav = useMemo(() => ({ trashCount: data ?? null, refreshTrashCount, eventsCount: eventsCount ?? null, folderCounts }), [data, refreshTrashCount, eventsCount, folderKey]);
    return _jsx(AdminNavContext.Provider, { value: nav, children: children });
}
/**
 * Frame shared by the list, media, templates and trash screens. Left is the shadcn Sidebar (a sheet on narrow screens),
 * with the screen title at the top right. On narrow screens, a header button opens the sidebar sheet.
 */
export function AdminShell({ title, count, sidebar, headerActions, bare, children, }) {
    const t = useTranslator(sharedMessages);
    const nav = useContext(AdminNavContext);
    const [actionsSlot, setActionsSlot] = useState(null);
    if (!nav) {
        return (_jsx(AdminNavProvider, { children: _jsx(AdminShell, { title: title, count: count, sidebar: sidebar, headerActions: headerActions, bare: bare, children: children }) }));
    }
    return (_jsxs(SidebarProvider, { className: "h-svh overflow-hidden", children: [_jsx(AdminSidebar, { ...sidebar, trashCount: nav.trashCount, eventsCount: nav.eventsCount, folderCounts: nav.folderCounts }), _jsxs(SidebarInset, { className: "min-w-0 overflow-hidden", children: [!bare && (_jsxs("header", { className: "flex h-13 shrink-0 items-center gap-3 border-b px-4 lg:px-5", children: [_jsx(SidebarTrigger, { "aria-label": t("shell.openSidebar"), className: "-ml-1 text-cms-muted-foreground md:hidden" }), _jsxs("h1", { className: "flex min-w-0 flex-1 items-baseline gap-2 truncate font-semibold text-[15px]", children: [_jsx("span", { className: "truncate", children: title }), count !== undefined && (_jsx("span", { className: "tabular font-normal text-cms-muted-foreground text-sm", children: count }))] }), _jsx("div", { ref: setActionsSlot, className: "flex items-center gap-2", children: headerActions })] })), _jsx(ActionsSlotContext.Provider, { value: actionsSlot, children: _jsx("div", { className: "flex min-h-0 flex-1 flex-col overflow-hidden", children: children }) })] })] }));
}
