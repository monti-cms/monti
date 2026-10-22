"use client";

import { type Site, useSite, useTranslator } from "@monti-cms/core/site";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@monti-cms/ui";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { entriesKeys, listEntries } from "../../api/entries";
import { countFailedEvents, eventsKeys } from "../../api/events";
import { foldersKeys, listFolders } from "../../api/folders";
import { AdminSidebar, type AdminSidebarProps } from "../admin-sidebar";
import { useAdminFeatures } from "./admin-features";
import { sharedMessages } from "./messages";
import { useNavQueriesReady } from "./nav-queries";
import { StatusBar, type StatusBarContextValue, type StatusBarScreen } from "./status-bar";

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

/**
 * A page inside the admin frame: the sidebar with `nav` active, `title` in the title bar, and the page below. The generic form of the pages that
 * only wrap a screen (event log, API keys, templates, a plugin's page); a page's own actions go in the title bar through {@link PageActions}.
 */
export function ShellPage({
	title,
	nav,
	count,
	bare,
	large,
	description,
	children,
}: {
	title: ReactNode;
	/** The sidebar item to mark as current (`events`, `tools:<path>`, ...). */
	nav: AdminSidebarProps["activeNav"];
	count?: number | string;
	bare?: boolean;
	/** The big page header with a one-line `description` under the title. */
	large?: boolean;
	description?: ReactNode;
	children: ReactNode;
}) {
	return (
		<AdminShell
			title={title}
			count={count}
			sidebar={{ activeNav: nav }}
			bare={bare}
			large={large}
			description={description}
		>
			{children}
		</AdminShell>
	);
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

/** What the status bar's items read for a shell page: the screen kind from the current sidebar item, and and the collection of a list. */
function shellStatusContext(site: Site, activeNav: AdminSidebarProps["activeNav"]): StatusBarContextValue {
	const isCollection = site.COLLECTIONS.includes(activeNav);
	const screen: StatusBarScreen = isCollection ? "list" : activeNav.startsWith("tools:") ? "tools" : activeNav;
	return {
		screen,
		...(isCollection ? { collection: activeNav } : {}),
	};
}

/** Trash badge state. The screen's list logic must update this value too, so it lives outside the shell. */
export function AdminNavProvider({ children }: { children: ReactNode }) {
	const site = useSite();
	const queryClient = useQueryClient();
	const ready = useNavQueriesReady();
	const features = useAdminFeatures();
	const { data } = useQuery({ queryKey: entriesKeys.trashCount(), queryFn: () => countTrash(site), enabled: ready });
	// A light background fetch. Errors (for example no access) are ignored so the sidebar never breaks.
	const { data: eventsCount } = useQuery({
		queryKey: eventsKeys.count(),
		queryFn: ({ signal }) => countFailedEvents(site, signal),
		retry: false,
		enabled: ready,
	});
	const folderTargets = useMemo(
		() => [...site.COLLECTIONS, ...(features.media ? ["media"] : [])],
		[site.COLLECTIONS, features.media],
	);
	// The sidebar needs to know which collections have folders, not only the open one. The list screen reads the same cache entries.
	const folderCounts = useQueries({
		queries: folderTargets.map((collection) => ({
			queryKey: foldersKeys.list(collection),
			queryFn: ({ signal }: { signal: AbortSignal }) => listFolders(site, collection, signal),
			enabled: ready && site.foldersEnabled(collection),
		})),
		combine: (results) =>
			Object.fromEntries(
				folderTargets.flatMap((collection, index) => {
					const folders = results[index]?.data;
					return folders ? [[collection, folders.length] as const] : [];
				}),
			),
	});
	const folderKey = JSON.stringify(folderCounts);
	const refreshTrashCount = useCallback(
		() => void queryClient.invalidateQueries({ queryKey: entriesKeys.trashCount() }),
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
	bare,
	description,
	large,
	children,
}: {
	title: ReactNode;
	/** Item count shown dimmed next to the title. Leave it out (undefined) while the first load runs, so it never shows a false 0. */
	count?: number | string;
	/** The big page header of the list screens: a large title with the count in mono, this one-line description under it, and the page actions bottom-aligned on the right. */
	large?: boolean;
	/** The muted line under a large title. */
	description?: ReactNode;
	sidebar: AdminSidebarProps;
	/** The screen draws its own page header (the Settings page): the shell then has no title bar of its own. */
	bare?: boolean;
	children: ReactNode;
}) {
	const t = useTranslator(sharedMessages);
	const site = useSite();
	const nav = useContext(AdminNavContext);
	const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
	if (!nav) {
		return (
			<AdminNavProvider>
				<AdminShell title={title} count={count} sidebar={sidebar} bare={bare} large={large} description={description}>
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
				{!bare && large && (
					<header className="flex shrink-0 items-end gap-3 px-8 pt-8 pb-4">
						<SidebarTrigger
							aria-label={t("shell.openSidebar")}
							className="-ml-1 self-start text-monti-muted md:hidden"
						/>
						<div className="min-w-0 flex-1">
							<h1 className="flex min-w-0 items-baseline gap-2 text-monti-heading">
								<span className="truncate">{title}</span>
								{count !== undefined && (
									<span className="tabular font-mono text-monti-caption text-monti-muted">{count}</span>
								)}
							</h1>
							{description && <p className="mt-1 text-monti-body text-monti-muted">{description}</p>}
						</div>
						<div ref={setActionsSlot} className="flex flex-wrap items-center justify-end gap-2" />
					</header>
				)}
				{!bare && !large && (
					<header className="flex h-13 shrink-0 items-center gap-3 border-b px-4 lg:px-4">
						<SidebarTrigger aria-label={t("shell.openSidebar")} className="-ml-1 text-monti-muted md:hidden" />
						<h1 className="flex min-w-0 flex-1 items-baseline gap-2 truncate text-monti-title">
							<span className="truncate">{title}</span>
							{count !== undefined && <span className="tabular text-monti-body text-monti-muted">{count}</span>}
						</h1>
						<div ref={setActionsSlot} className="flex items-center gap-2" />
					</header>
				)}
				<ActionsSlotContext.Provider value={actionsSlot}>
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
				</ActionsSlotContext.Provider>
				<StatusBar context={shellStatusContext(site, sidebar.activeNav)} />
			</SidebarInset>
		</SidebarProvider>
	);
}
