"use client";

import { type Site, useSite } from "@monti-cms/core/site";
import { Inline, SidebarInset, SidebarProvider, Stack } from "@monti-cms/ui";
import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { entriesKeys, listEntries } from "../../api/entries";
import { countFailedEvents, eventsKeys } from "../../api/events";
import { booleanCodec, usePreference } from "../../lib/hooks/use-preference";
import { AdminSidebar, type AdminSidebarProps } from "../admin-sidebar";
import { useNavQueriesReady } from "./nav-queries";
import { type ScreenContextValue, usePublishScreenContext } from "./screen-context";
import { SidePanelPane, SidePanelToggle } from "./side-panel-slot";
import { StatusBar, type StatusBarContextValue, type StatusBarScreen } from "./status-bar";

interface AdminNavContextValue {
	/** Number of trash items across all collections. null before loading. */
	trashCount: number | null;
	/** Number of failed and dead event deliveries. null before loading or when unavailable. */
	eventsCount: number | null;
}

const AdminNavContext = createContext<AdminNavContextValue | null>(null);

/** The counts the rail and the tools page's tabs show: the trash and the failed deliveries. `null` before they are known. */
export function useAdminNav(): AdminNavContextValue {
	return useContext(AdminNavContext) ?? { trashCount: null, eventsCount: null };
}

async function countTrash(site: Site): Promise<number> {
	const totals = await Promise.all(
		site.COLLECTIONS.map(async (collection) => {
			const query = new URLSearchParams({ collection, status: "trashed", pageSize: "25" });
			const data = await listEntries<{ total: number }>(site, query);
			return data.total;
		}),
	);
	return totals.reduce((sum, total) => sum + total, 0);
}

/** What the status bar's items read for a frame page: the screen kind from the current sidebar item, and the collection of a list. */
function frameStatusContext(site: Site, activeNav: AdminSidebarProps["activeNav"]): StatusBarContextValue {
	const isCollection = site.COLLECTIONS.includes(activeNav);
	const screen: StatusBarScreen = isCollection ? "list" : activeNav.startsWith("tools:") ? "tools" : activeNav;
	return {
		screen,
		...(isCollection ? { collection: activeNav } : {}),
	};
}

/** Where the admin is on a frame page, for the side panel: a collection (or the trash) is the entry list, and the other nav items name their own screen. */
function frameScreenContext(site: Site, activeNav: AdminSidebarProps["activeNav"]): Partial<ScreenContextValue> {
	if (site.COLLECTIONS.includes(activeNav)) return { screen: "entries", collection: activeNav };
	if (activeNav === "trash") return { screen: "entries" };
	if (activeNav === "media" || activeNav === "settings") return { screen: activeNav };
	return { screen: "other" };
}

/** The counts of the rail (the trash, the failed deliveries). The screen's list logic updates the trash count through the query cache, so they live outside the frame. */
export function AdminNavProvider({ children }: { children: ReactNode }) {
	const site = useSite();
	const ready = useNavQueriesReady();
	const { data } = useQuery({ queryKey: entriesKeys.trashCount(), queryFn: () => countTrash(site), enabled: ready });
	// A light background fetch. Errors (for example no access) are ignored so the sidebar never breaks.
	const { data: eventsCount } = useQuery({
		queryKey: eventsKeys.count(),
		queryFn: ({ signal }) => countFailedEvents(site, signal),
		retry: false,
		enabled: ready,
	});
	const nav = useMemo(() => ({ trashCount: data ?? null, eventsCount: eventsCount ?? null }), [data, eventsCount]);
	return <AdminNavContext.Provider value={nav}>{children}</AdminNavContext.Provider>;
}

/**
 * Frame of every admin page but the editor: the sidebar on the left (a drawer on narrow screens), the page beside it with the assistant's button in its
 * corner, the side panel a plugin adds, and the status bar. The page draws its own header in a `PageColumn`.
 */
export function AdminFrame({ sidebar, children }: { sidebar: AdminSidebarProps; children: ReactNode }) {
	const site = useSite();
	const nav = useContext(AdminNavContext);
	usePublishScreenContext(frameScreenContext(site, sidebar.activeNav));
	// Folded to the icon rail or not: remembered in this browser.
	const [rail, setRail] = usePreference("sidebar-rail", booleanCodec, false);
	if (!nav) {
		return (
			<AdminNavProvider>
				<AdminFrame sidebar={sidebar}>{children}</AdminFrame>
			</AdminNavProvider>
		);
	}

	return (
		<SidebarProvider fixed rail={rail} onRailChange={setRail}>
			<AdminSidebar {...sidebar} trashCount={nav.trashCount} eventsCount={nav.eventsCount} />
			<SidebarInset fixed corner={<SidePanelToggle />}>
				<Inline align="stretch" gap={0} grow minHeight={0} overflow="hidden">
					<Stack gap={0} grow minWidth={0} minHeight={0}>
						{children}
					</Stack>
					<SidePanelPane />
				</Inline>
				<StatusBar context={frameStatusContext(site, sidebar.activeNav)} />
			</SidebarInset>
		</SidebarProvider>
	);
}
