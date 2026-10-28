"use client";

import { type Site, useSite } from "@monti-cms/core/site";
import { Inline, SidebarInset, SidebarProvider, Stack } from "@monti-cms/ui";
import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import { entriesKeys } from "../../api/entries";
import { countFailedEvents, eventsKeys } from "../../api/events";
import { countTrash } from "../../api/trash";
import { booleanCodec, usePreference } from "../../lib/hooks/use-preference";
import { AdminSidebar, type AdminSidebarProps } from "../admin-sidebar";
import { useNavQueriesReady } from "./nav-queries";
import { PanelDockContext } from "./panel-dock";
import { type ScreenContextValue, usePublishScreenContext } from "./screen-context";
import { SidePanelPane, SidePanelToggle } from "./side-panel-slot";

interface AdminNavContextValue {
	/** Number of units in the trash (entries, items, folders and files). null before loading. */
	trashCount: number | null;
	/** Number of failed and dead event deliveries. null before loading or when unavailable. */
	eventsCount: number | null;
}

const AdminNavContext = createContext<AdminNavContextValue | null>(null);

/** The counts the rail and the tools page's tabs show: the trash and the failed deliveries. `null` before they are known. */
export function useAdminNav(): AdminNavContextValue {
	return useContext(AdminNavContext) ?? { trashCount: null, eventsCount: null };
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
	const { data } = useQuery({
		queryKey: entriesKeys.trashCount(),
		queryFn: ({ signal }) => countTrash(site, signal),
		enabled: ready,
	});
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
 * corner, and at the right edge, full height, the dock for the side panels (a record, a file, an activity, a plugin's panel). The page draws its own header in a `PageColumn`.
 */
export function AdminFrame({ sidebar, children }: { sidebar: AdminSidebarProps; children: ReactNode }) {
	const site = useSite();
	const nav = useContext(AdminNavContext);
	usePublishScreenContext(frameScreenContext(site, sidebar.activeNav));
	// Folded to the icon rail or not: remembered in this browser.
	const [rail, setRail] = usePreference("sidebar-rail", booleanCodec, false);
	// Where the side panels of the screens dock: the window's right edge, beside the whole page.
	const [dock, setDock] = useState<HTMLElement | null>(null);
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
				<PanelDockContext.Provider value={dock}>
					<Inline align="stretch" gap={0} grow minHeight={0} overflow="hidden">
						<Stack gap={0} grow minWidth={0} minHeight={0} container>
							{children}
						</Stack>
						<Inline ref={setDock} align="stretch" gap={0} shrink={false} />
						<SidePanelPane />
					</Inline>
				</PanelDockContext.Provider>
			</SidebarInset>
		</SidebarProvider>
	);
}
