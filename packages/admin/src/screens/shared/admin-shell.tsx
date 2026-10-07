"use client";

import { cmsApiUrl, type Site, useSite, useTranslator } from "@monti-cms/core/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../../ui/sidebar";
import { cmsFetch } from "../admin-api";
import { AdminSidebar, type AdminSidebarProps } from "../admin-sidebar";
import { countFailedEvents, EVENTS_COUNT_KEY } from "../events/events-api";
import { TRASH_COUNT_KEY } from "./list-cache";
import { sharedMessages } from "./messages";

interface AdminNavContextValue {
	/** Number of trash items across all collections. null before loading. */
	trashCount: number | null;
	refreshTrashCount: () => void;
	/** Number of failed and dead event deliveries. null before loading or when unavailable. */
	eventsCount: number | null;
}

const AdminNavContext = createContext<AdminNavContextValue | null>(null);

/** Recomputes the sidebar trash badge (call after moving to trash, restoring or permanent delete). */
export const useAdminNav = (): AdminNavContextValue =>
	useContext(AdminNavContext) ?? { trashCount: null, refreshTrashCount: () => {}, eventsCount: null };

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
	const refreshTrashCount = useCallback(
		() => void queryClient.invalidateQueries({ queryKey: TRASH_COUNT_KEY }),
		[queryClient],
	);
	const nav = useMemo(
		() => ({ trashCount: data ?? null, refreshTrashCount, eventsCount: eventsCount ?? null }),
		[data, refreshTrashCount, eventsCount],
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
	children,
}: {
	title: ReactNode;
	/** Item count shown dimmed next to the title. */
	count?: number;
	sidebar: AdminSidebarProps;
	headerActions?: ReactNode;
	children: ReactNode;
}) {
	const t = useTranslator(sharedMessages);
	const nav = useContext(AdminNavContext);
	if (!nav) {
		return (
			<AdminNavProvider>
				<AdminShell title={title} count={count} sidebar={sidebar} headerActions={headerActions}>
					{children}
				</AdminShell>
			</AdminNavProvider>
		);
	}

	return (
		<SidebarProvider className="h-svh overflow-hidden">
			<AdminSidebar {...sidebar} trashCount={nav.trashCount} eventsCount={nav.eventsCount} />
			<SidebarInset className="min-w-0 overflow-hidden">
				<header className="flex h-13 shrink-0 items-center gap-3 border-b px-4 lg:px-5">
					<SidebarTrigger aria-label={t("shell.openSidebar")} className="-ml-1 text-cms-muted-foreground md:hidden" />
					<h1 className="flex min-w-0 flex-1 items-baseline gap-2 truncate font-semibold text-[15px]">
						<span className="truncate">{title}</span>
						{count !== undefined && (
							<span className="tabular font-normal text-cms-muted-foreground text-sm">{count}</span>
						)}
					</h1>
					<div className="flex items-center gap-2">{headerActions}</div>
				</header>
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
