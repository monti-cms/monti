"use client";

import { type Site, useSite, useTranslator } from "@monti-cms/core/site";
import { Box, Heading, Inline, SidebarInset, SidebarProvider, SidebarTrigger, Stack, Text } from "@monti-cms/ui";
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
import { type ScreenContextValue, usePublishScreenContext } from "./screen-context";
import { SidePanelPane, SidePanelToggle } from "./side-panel-slot";
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

/** The element after the title, where a page's status chip goes (see {@link PageMeta}). */
const MetaSlotContext = createContext<HTMLElement | null>(null);

/**
 * Puts a page's action buttons (the one primary action, such as "Add template") on the right of the title bar. The page decides what they are, because they
 * depend on its state; the shell only provides the place. Renders nothing until the title bar is mounted.
 */
export function PageActions({ children }: { children: ReactNode }) {
	const slot = useContext(ActionsSlotContext);
	return slot
		? createPortal(
				<Inline wrap gap={8} justify="end">
					{children}
				</Inline>,
				slot,
			)
		: null;
}

/** Puts a page's status next to its title (the settings file and its version). Renders nothing until the title bar is mounted. */
export function PageMeta({ children }: { children: ReactNode }) {
	const slot = useContext(MetaSlotContext);
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
	description,
	children,
}: {
	title: ReactNode;
	/** The sidebar item to mark as current (`events`, `tools:<path>`, ...). */
	nav: AdminSidebarProps["activeNav"];
	count?: number | string;
	description?: ReactNode;
	children: ReactNode;
}) {
	return (
		<AdminShell title={title} count={count} sidebar={{ activeNav: nav }} description={description}>
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

/** Where the admin is on a shell page, for the side panel: a collection (or the trash) is the entry list, and the other nav items name their own screen. */
function shellScreenContext(site: Site, activeNav: AdminSidebarProps["activeNav"]): Partial<ScreenContextValue> {
	if (site.COLLECTIONS.includes(activeNav)) return { screen: "entries", collection: activeNav };
	if (activeNav === "trash") return { screen: "entries" };
	if (activeNav === "media" || activeNav === "settings") return { screen: activeNav };
	return { screen: "other" };
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
 * Frame of every admin page but the editor. Left is the shadcn Sidebar (a sheet on narrow screens); on the right one quiet title bar (the title, its count,
 * a short description and the page's actions in a single row, so the content starts high) over the page. Tabs a page has sit right under it.
 */
export function AdminShell({
	title,
	count,
	sidebar,
	description,
	editorial = false,
	children,
}: {
	title: ReactNode;
	/** Item count shown dimmed next to the title. Leave it out (undefined) while the first load runs, so it never shows a false 0. */
	count?: number | string;
	/** A short muted line after the title (where the collection is public); hidden on narrow screens. */
	description?: ReactNode;
	/** Centered editorial index header with a deep ink rule (`border="bottom-strong"`). */
	editorial?: boolean;
	sidebar: AdminSidebarProps;
	children: ReactNode;
}) {
	const t = useTranslator(sharedMessages);
	const site = useSite();
	const nav = useContext(AdminNavContext);
	const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
	const [metaSlot, setMetaSlot] = useState<HTMLElement | null>(null);
	usePublishScreenContext(shellScreenContext(site, sidebar.activeNav));
	if (!nav) {
		return (
			<AdminNavProvider>
				<AdminShell title={title} count={count} sidebar={sidebar} description={description} editorial={editorial}>
					{children}
				</AdminShell>
			</AdminNavProvider>
		);
	}

	return (
		<SidebarProvider fixed>
			<AdminSidebar
				{...sidebar}
				trashCount={nav.trashCount}
				eventsCount={nav.eventsCount}
				folderCounts={nav.folderCounts}
			/>
			<SidebarInset fixed>
				<Inline align="stretch" gap={0} grow minHeight={0} overflow="hidden">
					<Stack gap={0} grow minWidth={0} minHeight={0}>
						{editorial ? (
							<Box width="full" maxWidth="content" centered paddingX={32} paddingTop={24} shrink={false}>
								<Inline
									as="header"
									container
									align="end"
									justify="between"
									gap={12}
									border="bottom-strong"
									paddingBottom={12}
								>
									<Inline gap={8} align="baseline" grow minWidth={0}>
										<Box hideFrom="md">
											<SidebarTrigger aria-label={t("shell.openSidebar")} />
										</Box>
										<Box minWidth={0}>
											<Heading as="h1" variant="heading">
												<Inline as="span" gap={8} align="baseline">
													<Text truncate>{title}</Text>
													{count !== undefined && (
														<Text variant="caption" tone="muted" mono>
															{count}
														</Text>
													)}
												</Inline>
											</Heading>
										</Box>
										<Inline gap={8} align="center" ref={setMetaSlot} />
										{description && (
											<Box minWidth={0} hideBelowContainer="2xl">
												<Text as="p" variant="caption" tone="muted" truncate>
													{description}
												</Text>
											</Box>
										)}
									</Inline>
									<Inline gap={8}>
										<div ref={setActionsSlot} />
										<SidePanelToggle />
									</Inline>
								</Inline>
							</Box>
						) : (
							<Inline
								as="header"
								container
								wrap
								gap={12}
								shrink={false}
								border="bottom"
								paddingX={32}
								paddingY={4}
								minHeight="header"
							>
								<Box hideFrom="md">
									<SidebarTrigger aria-label={t("shell.openSidebar")} />
								</Box>
								<Inline gap={8} align="baseline" grow>
									{/* The title and its count keep their width: what gives way, when the page has little room, is the description and the actions. */}
									<Box shrink={false}>
										<Heading as="h1" variant="title">
											<Inline as="span" gap={8} align="baseline">
												<Text>{title}</Text>
												{count !== undefined && (
													<Text variant="caption" tone="muted" mono>
														{count}
													</Text>
												)}
											</Inline>
										</Heading>
									</Box>
									<Inline gap={8} align="center" ref={setMetaSlot} />
									{description && (
										<Box minWidth={0} hideBelowContainer="2xl">
											<Text as="p" variant="caption" tone="muted" truncate>
												{description}
											</Text>
										</Box>
									)}
								</Inline>
								<div ref={setActionsSlot} />
								<SidePanelToggle />
							</Inline>
						)}
						<MetaSlotContext.Provider value={metaSlot}>
							<ActionsSlotContext.Provider value={actionsSlot}>
								<Stack gap={0} grow minHeight={0} overflow="hidden">
									{children}
								</Stack>
							</ActionsSlotContext.Provider>
						</MetaSlotContext.Provider>
					</Stack>
					<SidePanelPane />
				</Inline>
				<StatusBar context={shellStatusContext(site, sidebar.activeNav)} />
			</SidebarInset>
		</SidebarProvider>
	);
}
