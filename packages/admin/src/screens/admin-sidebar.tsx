"use client";

import { Image, Launch, SettingsAdjust, Tools, TrashCan } from "@carbon/icons-react";
import type { Folder } from "@monti-cms/core/site";
import { type Collection, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Count,
	Sidebar,
	SidebarContent,
	SidebarFoot,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarIconLink,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarRailToggle,
	Text,
	useSidebar,
} from "@monti-cms/ui";
import { type DragEvent, Fragment, type ReactNode, useState } from "react";
import { AdminLink as Link } from "../router";
import { ThemeMenu } from "../ui/theme-menu";
import { screensMessages } from "./messages";
import { railFolders } from "./rail-folders";
import { useAdminFeatures } from "./shared/admin-features";
import { CollectionIcon } from "./shared/collection-icon";
import { type DraggedEntry, isEntryDrag, readDraggedEntries } from "./shared/entry-drag";
import { isToolsNav, type ToolsId, toolsHref } from "./tools/tools-tabs";

/** Value that points to the current screen in the sidebar. Every Settings tab is the one `settings` entry; every page of the tools page marks the one `tools` row. */
export type AdminNavId = Collection | "media" | "settings" | "trash" | ToolsId;

/** Folder navigation, passed by the list screen. The sidebar draws it as a list of folders under the collection it belongs to. */
export interface FolderNavigation {
	collection: Collection | "media";
	/** `all` (top level) or a folder ID. */
	currentFolder: string;
	/** The folders of the collection; with `entryCount` each shows its count at the right. */
	folders: readonly (Folder & { entryCount?: number })[];
	onSelectFolder: (folder: string) => void;
	/** When a list row is dragged and dropped onto a folder. */
	onDropEntries: (folderId: string | null, entries: DraggedEntry[]) => void;
}

export interface AdminSidebarProps {
	activeNav: AdminNavId;
	folderNav?: FolderNavigation;
	trashCount?: number | null;
	/** Failed and dead event deliveries: shown on the tools row. */
	eventsCount?: number | null;
}

/** The folders of the open collection, under its row: top-level folders, and the folders inside the ones on the open path. Click opens one; entries can be dropped on one. */
function FolderList({ nav, label, closeMobile }: { nav: FolderNavigation; label: string; closeMobile: () => void }) {
	const t = useTranslator(screensMessages);
	const [dropTarget, setDropTarget] = useState<string | null>(null);
	const rows = railFolders(nav.folders, nav.currentFolder);
	if (rows.length === 0) return null;

	const dropProps = (folderId: string) => ({
		onDragOver: (event: DragEvent) => {
			if (!isEntryDrag(event)) return;
			event.preventDefault();
			setDropTarget(folderId);
		},
		onDragLeave: () => setDropTarget((current) => (current === folderId ? null : current)),
		onDrop: (event: DragEvent) => {
			event.preventDefault();
			setDropTarget(null);
			const entries = readDraggedEntries(event);
			if (entries.length > 0) nav.onDropEntries(folderId, entries);
		},
	});

	return (
		<li>
			<SidebarMenuSub aria-label={t("sidebar.folderTree", { label })}>
				{rows.map(({ folder, depth }) => {
					const active = nav.currentFolder === folder.id;
					return (
						<li key={folder.id}>
							<SidebarMenuSubButton
								render={<button type="button" />}
								isActive={active}
								aria-current={active ? "true" : undefined}
								depth={Math.min(depth, 3) as 0 | 1 | 2 | 3}
								dropTarget={dropTarget === folder.id}
								onClick={() => {
									nav.onSelectFolder(folder.id);
									closeMobile();
								}}
								{...dropProps(folder.id)}
							>
								<span>{folder.name}</span>
								{folder.entryCount !== undefined && <Count>{folder.entryCount}</Count>}
							</SidebarMenuSubButton>
						</li>
					);
				})}
			</SidebarMenuSub>
		</li>
	);
}

/**
 * Left navigation: the site's name and the way to the site, the content (each collection, then media; the open one opens its folders under it), and,
 * under a line at the bottom, the trash, the tools and the settings. Every row is a link; the folders are the only buttons.
 */
export function AdminSidebar({ activeNav, folderNav, trashCount, eventsCount }: AdminSidebarProps) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const { isMobile, setOpenMobile, rail } = useSidebar();
	const features = useAdminFeatures();
	const closeMobile = () => {
		if (isMobile) setOpenMobile(false);
	};

	const row = ({
		href,
		current,
		label,
		icon,
		badge,
		tooltip,
		railDot,
		onOpen,
	}: {
		href: string;
		current: boolean;
		label: string;
		icon: ReactNode;
		badge?: ReactNode;
		/** What the row says folded to its icon: its name, and its count when it has one. */
		tooltip: string;
		/** The name of the dot an icon shows folded when something needs a look. */
		railDot?: string;
		onOpen?: () => void;
	}) => (
		<SidebarMenuItem key={href}>
			<SidebarMenuButton
				isActive={current}
				tooltip={tooltip}
				railDot={railDot}
				render={
					<Link
						href={href}
						onClick={() => {
							onOpen?.();
							closeMobile();
						}}
						aria-current={current ? "page" : undefined}
					/>
				}
			>
				{icon}
				<span>{label}</span>
				{badge}
			</SidebarMenuButton>
		</SidebarMenuItem>
	);

	/** A row with the folders of its scope under it: they show under the open screen when that screen passes `folderNav`. */
	const withFolders = (scope: string, label: string, href: string, icon: ReactNode) => {
		const open = activeNav === scope;
		const nav = open && folderNav?.collection === scope ? folderNav : undefined;
		return (
			<Fragment key={scope}>
				{row({
					href,
					current: open && (!nav || nav.currentFolder === "all" || nav.currentFolder === ""),
					label,
					tooltip: label,
					icon,
					onOpen: () => nav?.onSelectFolder("all"),
				})}
				{nav && !rail && <FolderList nav={nav} label={label} closeMobile={closeMobile} />}
			</Fragment>
		);
	};

	return (
		<Sidebar label={t("sidebar.label")}>
			<SidebarHeader>
				{!rail && (
					<>
						<Box grow minWidth={0}>
							<Link href={site.adminHref()} onClick={closeMobile}>
								<Text variant="title" truncate>
									{site.SITE_NAME || "CMS"}
								</Text>
							</Link>
						</Box>
						{/* Site home (`site.home`, default `/`). The admin screen lives inside the site app, so `/` is the site. Opens in a new tab so the admin stays. */}
						<SidebarIconLink
							label={t("sidebar.viewSite")}
							render={<Link role="link" href={site.SITE_HOME} target="_blank" rel="noopener noreferrer" />}
						>
							<Launch aria-hidden />
						</SidebarIconLink>
					</>
				)}
				<SidebarRailToggle />
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu aria-label={t("sidebar.content")}>
							{site.COLLECTIONS.map((collection) =>
								withFolders(
									collection,
									site.COLLECTION_DEFINITIONS[collection].label,
									site.adminHref(`?collection=${collection}`),
									<CollectionIcon collection={collection} />,
								),
							)}
							{features.media &&
								withFolders("media", t("sidebar.media"), site.adminHref("/media"), <Image aria-hidden />)}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu aria-label={t("sidebar.bottom")}>
					{row({
						href: site.adminHref("/trash"),
						current: activeNav === "trash",
						label: t("sidebar.trash"),
						tooltip: trashCount ? `${t("sidebar.trash")} ${trashCount}` : t("sidebar.trash"),
						icon: <TrashCan aria-hidden />,
						badge: trashCount ? (
							<SidebarMenuBadge aria-label={t("sidebar.trashBadge", { count: trashCount })}>
								{trashCount}
							</SidebarMenuBadge>
						) : null,
					})}
					{row({
						href: toolsHref(site),
						current: isToolsNav(activeNav),
						label: t("sidebar.tools"),
						tooltip: eventsCount ? `${t("sidebar.tools")} ${eventsCount}` : t("sidebar.tools"),
						railDot: eventsCount ? t("sidebar.eventsBadge", { count: eventsCount }) : undefined,
						icon: <Tools aria-hidden />,
						badge: eventsCount ? (
							<SidebarMenuBadge tone="warning" aria-label={t("sidebar.eventsBadge", { count: eventsCount })}>
								{eventsCount}
							</SidebarMenuBadge>
						) : null,
					})}
					{row({
						href: site.adminHref("/settings"),
						current: activeNav === "settings",
						label: t("sidebar.settings"),
						tooltip: t("sidebar.settings"),
						icon: <SettingsAdjust aria-hidden />,
					})}
				</SidebarMenu>
				<SidebarFoot>
					<ThemeMenu />
				</SidebarFoot>
			</SidebarFooter>
		</Sidebar>
	);
}
