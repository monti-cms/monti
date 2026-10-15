"use client";

import { type Site, useSite, useTranslator } from "@monti-cms/core/client";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { entriesKeys, listEntries } from "../../api/entries";
import { countFailedEvents, eventsKeys } from "../../api/events";
import { foldersKeys, listFolders } from "../../api/folders";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../../ui/sidebar";
import { AdminSidebar, type AdminSidebarProps } from "../admin-sidebar";
import { useAdminFeatures } from "./admin-features";
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

/**
 * A page inside the admin frame: the sidebar with `nav` active, `title` in the title bar, and the page below. The generic form of the pages that
 * only wrap a screen (event log, API keys, templates, a plugin's page); a page's own actions go in the title bar through {@link PageActions}.
 */
export function ShellPage({
	title,
	nav,
	count,
	bare,
	children,
}: {
	title: ReactNode;
	/** The sidebar item to mark as current (`events`, `tools:<path>`, ...). */
	nav: AdminSidebarProps["activeNav"];
	count?: number;
	bare?: boolean;
	children: ReactNode;
}) {
	return (
		<AdminShell title={title} count={count} sidebar={{ activeNav: nav }} bare={bare}>
			{children}
		</AdminShell>
	);
}

/** Recomputes the sidebar trash badge (call after moving to trash, restoring or permanent delete). */
export const useAdminNav = (): AdminNavContextValue =>
	useContext(AdminNavContext) ?? { trashCount: null, refreshTrashCount: () => {}, eventsCount: null, folderCounts: {} };

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

/** The longest the sidebar's background counts wait for the page's own requests. */
const NAV_QUERIES_MAX_WAIT_MS = 2500;

const startsWith = (key: readonly unknown[], prefix: readonly unknown[]) =>
	prefix.every((part, index) => key[index] === part);

/** The sidebar's counts are background work (a request per collection for the trash and for the folders). */
const isNavQuery = (key: readonly unknown[]) =>
	startsWith(key, foldersKeys.all) || startsWith(key, eventsKeys.count()) || startsWith(key, entriesKeys.trashCount());

/**
 * Whether the sidebar's counts may start. A screen's own list is what the person waits for, and a browser sends only a handful of requests to one host at a
 * time, so the counts (two requests per collection) wait until the page's requests have finished, or a short while at most.
 */
function useNavQueriesReady(): boolean {
	const queryClient = useQueryClient();
	const [ready, setReady] = useState(false);
	useEffect(() => {
		const idle = () => queryClient.isFetching({ predicate: (query) => !isNavQuery(query.queryKey) }) === 0;
		const started = Date.now();
		const timer = setInterval(() => {
			if (idle() || Date.now() - started > NAV_QUERIES_MAX_WAIT_MS) {
				setReady(true);
				clearInterval(timer);
			}
		}, 60);
		return () => clearInterval(timer);
	}, [queryClient]);
	return ready;
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
			enabled:
				ready &&
				(collection === "media" ||
					(site.COLLECTION_DEFINITIONS[collection]?.folders ??
						site.COLLECTION_DEFINITIONS[collection]?.kind !== "item")),
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
	children,
}: {
	title: ReactNode;
	/** Item count shown dimmed next to the title. */
	count?: number;
	sidebar: AdminSidebarProps;
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
				<AdminShell title={title} count={count} sidebar={sidebar} bare={bare}>
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
						<div ref={setActionsSlot} className="flex items-center gap-2" />
					</header>
				)}
				<ActionsSlotContext.Provider value={actionsSlot}>
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
				</ActionsSlotContext.Provider>
			</SidebarInset>
		</SidebarProvider>
	);
}
