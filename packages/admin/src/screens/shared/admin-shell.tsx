"use client";

import { cmsApiUrl, type Site, useSite, useTranslator } from "@monti-cms/core/client";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../../ui/sidebar";
import { cmsFetch } from "../admin-api";
import { AdminSidebar, type AdminSidebarProps } from "../admin-sidebar";
import { countFailedEvents, EVENTS_COUNT_KEY } from "../events/events-api";
import { fetchFolders, foldersKey, TRASH_COUNT_KEY } from "./list-cache";
import { sharedMessages } from "./messages";

interface AdminNavContextValue {
	/** Number of trash items across all collections. null before loading. */
	trashCount: number | null;
	refreshTrashCount: () => void;
	/** Number of failed and dead event deliveries. null before loading or when unavailable. */
	eventsCount: number | null;
	/** How many folders each collection has (a collection whose folders are not loaded yet is missing). The sidebar shows a chevron for a collection that has some. */
	folderCounts: Readonly<Record<string, number>>;
}

const AdminNavContext = createContext<AdminNavContextValue | null>(null);

/** The element on the right of the shell's title bar, where a page's own actions go (see {@link PageActions}). */
const ActionsSlotContext = createContext<HTMLElement | null>(null);

/**
 * Puts a page's action buttons (the one primary action, such as "Add template") on the right of the title bar. The page decides what they are, because they
 * depend on its state; the shell only provides the place. Renders nothing until the title bar is mounted.
 */
export function PageActions({ children }: { children: ReactNode }) {
	const slot = useContext(ActionsSlotContext);
	return slot ? createPortal(children, slot) : null;
}

/** Recomputes the sidebar trash badge (call after moving to trash, restoring or permanent delete). */
export const useAdminNav = (): AdminNavContextValue =>
	useContext(AdminNavContext) ?? { trashCount: null, refreshTrashCount: () => {}, eventsCount: null, folderCounts: {} };

async function countTrash(site: Site): Promise<number> {
	const totals = await Promise.all(
		site.COLLECTIONS.map(async (collection) => {
			const query = new URLSearchParams({ collection, status: "trashed", pageSize: "25" });
			const data = await cmsFetch<{ total: number }>(site, cmsApiUrl(`/v1/entries?${query.toString()}`));
			return data.total;
		}),
	);
	return totals.reduce((sum, total) => sum + total, 0);
}

/** Trash badge state. The screen's list logic must update this value too, so it lives outside the shell. */
export function AdminNavProvider({ children }: { children: ReactNode }) {
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
			queryFn: ({ signal }: { signal: AbortSignal }) => fetchFolders(site, collection, signal),
			retry: false,
		})),
		combine: (results) =>
			Object.fromEntries(
				site.COLLECTIONS.flatMap((collection, index) => {
					const folders = results[index]?.data;
					return folders ? [[collection, folders.length] as const] : [];
				}),
			),
	});
	const folderKey = JSON.stringify(folderCounts);
	const refreshTrashCount = useCallback(
		() => void queryClient.invalidateQueries({ queryKey: TRASH_COUNT_KEY }),
		[queryClient],
	);
	// biome-ignore lint/correctness/useExhaustiveDependencies: `folderKey` is the stable identity of `folderCounts`
	const nav = useMemo(
		() => ({ trashCount: data ?? null, refreshTrashCount, eventsCount: eventsCount ?? null, folderCounts }),
		[data, refreshTrashCount, eventsCount, folderKey],
	);
	return <AdminNavContext.Provider value={nav}>{children}</AdminNavContext.Provider>;
}

/**
 * Frame shared by the list, media, templates and trash screens. Left is the shadcn Sidebar (a sheet on narrow screens),
 * with the screen title at the top right. On narrow screens, a header button opens the sidebar sheet.
 */
export function AdminShell({
	title,
	count,
	sidebar,
	headerActions,
	bare,
	children,
}: {
	title: ReactNode;
	/** Item count shown dimmed next to the title. */
	count?: number;
	sidebar: AdminSidebarProps;
	headerActions?: ReactNode;
	/** The screen draws its own page header (the Settings page): the shell then has no title bar of its own. */
	bare?: boolean;
	children: ReactNode;
}) {
	const t = useTranslator(sharedMessages);
	const nav = useContext(AdminNavContext);
	const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
	if (!nav) {
		return (
			<AdminNavProvider>
				<AdminShell title={title} count={count} sidebar={sidebar} headerActions={headerActions} bare={bare}>
					{children}
				</AdminShell>
			</AdminNavProvider>
		);
	}

	return (
		<SidebarProvider className="h-svh overflow-hidden">
			<AdminSidebar
				{...sidebar}
				trashCount={nav.trashCount}
				eventsCount={nav.eventsCount}
				folderCounts={nav.folderCounts}
			/>
			<SidebarInset className="min-w-0 overflow-hidden">
				{!bare && (
					<header className="flex h-13 shrink-0 items-center gap-3 border-b px-4 lg:px-5">
						<SidebarTrigger aria-label={t("shell.openSidebar")} className="-ml-1 text-cms-muted-foreground md:hidden" />
						<h1 className="flex min-w-0 flex-1 items-baseline gap-2 truncate font-semibold text-[15px]">
							<span className="truncate">{title}</span>
							{count !== undefined && (
								<span className="tabular font-normal text-cms-muted-foreground text-sm">{count}</span>
							)}
						</h1>
						<div ref={setActionsSlot} className="flex items-center gap-2">
							{headerActions}
						</div>
					</header>
				)}
				<ActionsSlotContext.Provider value={actionsSlot}>
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
				</ActionsSlotContext.Provider>
			</SidebarInset>
		</SidebarProvider>
	);
}
