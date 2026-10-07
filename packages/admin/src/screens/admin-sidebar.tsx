"use client";

import { type Collection, useSite, useTranslator } from "@monti-cms/core/client";
import type { Folder } from "@monti-cms/core/runtime";
import {
	ChevronRight,
	FileImage,
	Folder as FolderIcon,
	FolderOpen,
	FolderPlus,
	Globe,
	LayoutTemplate,
	Plus,
	Settings2,
	Trash2,
} from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { cn } from "../lib/utils/cn";
import { AdminLink as Link } from "../router";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { IconButton } from "../ui/icon-button";
import { Label } from "../ui/label";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubItem,
	SidebarTrigger,
	useSidebar,
} from "../ui/sidebar";
import { Switch } from "../ui/switch";
import { ThemeToggle } from "../ui/theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { screensMessages } from "./messages";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "./shared/action-menu";
import { useAdminFeatures } from "./shared/admin-features";
import { CollectionIcon, NamedIcon } from "./shared/collection-icon";
import { type DraggedEntry, isEntryDrag, readDraggedEntries } from "./shared/entry-drag";
import { type FolderActions, folderMenuActions } from "./shared/use-folder-actions";

/** Value that points to the current screen in the sidebar. For a plugin screen, that screen's address (`nav.path`, e.g. `ai`). */
export type AdminNavId = Collection | "media" | "templates" | "schema" | "trash" | (string & {});

/** Folder navigation used only on the list screen. */
export interface FolderNavigation {
	collection: Collection;
	/** `all` (top level) or a folder ID. */
	currentFolder: string;
	includeDescendants: boolean;
	folders: Folder[];
	folderActions: FolderActions;
	onSelectFolder: (folder: string) => void;
	onIncludeDescendantsChange: (value: boolean) => void;
	/** When a list row is dragged and dropped onto a folder (or the top level). */
	onDropEntries: (folderId: string | null, entries: DraggedEntry[]) => void;
	onCreateEntry: () => void;
}

export interface AdminSidebarProps {
	activeNav: AdminNavId;
	folderNav?: FolderNavigation;
	trashCount?: number | null;
}

/** Like a file explorer: F2 opens rename, Delete opens delete (confirm dialog). */
export function folderKeyHandler(folder: Folder, actions: FolderActions) {
	return (event: KeyboardEvent) => {
		if (event.key === "F2") {
			event.preventDefault();
			actions.requestRename(folder);
		} else if (event.key === "Delete") {
			event.preventDefault();
			void actions.requestDelete(folder);
		}
	};
}

/**
 * Tree connector lines. Draws a vertical line and an L-shaped (`ㄴ`) horizontal line on the left of each row, and the last row's vertical line stops at the horizontal line.
 * The horizontal line sits at 14px, half the row height (28px). The vertical line passes through the center of the parent folder icon (or top-level icon).
 */
const TREE_LIST = "mx-0 translate-x-0 gap-0 border-l-0 py-0 pr-0 pl-6";
const TREE_ITEM =
	"before:-left-3 after:-left-3 before:absolute before:top-0 before:h-full before:w-px before:bg-cms-sidebar-foreground/20 after:absolute after:top-3.5 after:h-px after:w-3.5 after:bg-cms-sidebar-foreground/20 last:before:h-3.5";

function FolderTree({ nav, closeMobile }: { nav: FolderNavigation; closeMobile: () => void }) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
	const [dropTarget, setDropTarget] = useState<string | null>(null);
	const { folders, currentFolder } = nav;

	// Expand the ancestor path of the selected folder.
	useEffect(() => {
		if (currentFolder === "all") return;
		setExpandedIds((prev) => {
			const next = new Set(prev);
			let folder = folders.find((f) => f.id === currentFolder);
			while (folder?.parentId) {
				next.add(folder.parentId);
				folder = folders.find((f) => f.id === folder?.parentId);
			}
			return next;
		});
	}, [currentFolder, folders]);

	const select = (folder: string) => {
		nav.onSelectFolder(folder);
		closeMobile();
	};

	const dropProps = (key: string, folderId: string | null) => ({
		onDragOver: (event: React.DragEvent) => {
			if (!isEntryDrag(event)) return;
			event.preventDefault();
			setDropTarget(key);
		},
		onDragLeave: () => setDropTarget((current) => (current === key ? null : current)),
		onDrop: (event: React.DragEvent) => {
			event.preventDefault();
			setDropTarget(null);
			const entries = readDraggedEntries(event);
			if (entries.length > 0) nav.onDropEntries(folderId, entries);
		},
	});

	const renderFolder = (folder: Folder) => {
		const children = folders.filter((f) => f.parentId === folder.id);
		const isExpanded = expandedIds.has(folder.id);
		const isActive = currentFolder === folder.id;
		const actions = folderMenuActions(site, folder, nav.folders, nav.folderActions);
		return (
			<Collapsible
				key={folder.id}
				open={isExpanded}
				onOpenChange={(open) =>
					setExpandedIds((prev) => {
						const next = new Set(prev);
						if (open) next.add(folder.id);
						else next.delete(folder.id);
						return next;
					})
				}
				render={<SidebarMenuSubItem className={TREE_ITEM} />}
			>
				<ActionContextMenu
					actions={actions}
					trigger={
						<div
							{...dropProps(folder.id, folder.id)}
							data-active={isActive || undefined}
							className={cn(
								"group/folder flex h-7 items-center rounded-md text-cms-sidebar-foreground hover:bg-cms-sidebar-accent hover:text-cms-sidebar-accent-foreground data-active:bg-cms-sidebar-accent data-active:font-medium data-active:text-cms-sidebar-accent-foreground",
								dropTarget === folder.id && "ring-2 ring-cms-sidebar-ring",
							)}
						/>
					}
				>
					{/* The folder icon doubles as the expand button. When there are subfolders, hovering or focusing turns it into an arrow. */}
					{children.length > 0 ? (
						<CollapsibleTrigger
							aria-label={t(isExpanded ? "sidebar.folderCollapse" : "sidebar.folderExpand", { name: folder.name })}
							className="group/toggle flex size-6 shrink-0 items-center justify-center rounded-md outline-hidden hover:bg-cms-sidebar-foreground/10 focus-visible:ring-2 focus-visible:ring-cms-sidebar-ring [&_svg]:size-4"
						>
							<span className="group-hover/toggle:hidden group-focus-visible/toggle:hidden">
								{isExpanded ? <FolderOpen aria-hidden /> : <FolderIcon aria-hidden />}
							</span>
							<ChevronRight
								aria-hidden
								className={cn(
									"hidden transition-transform group-hover/toggle:block group-focus-visible/toggle:block",
									isExpanded && "rotate-90",
								)}
							/>
						</CollapsibleTrigger>
					) : (
						<span aria-hidden className="flex size-6 shrink-0 items-center justify-center">
							<FolderIcon className="size-4" />
						</span>
					)}
					<SidebarMenuButton
						size="sm"
						isActive={isActive}
						aria-current={isActive ? "true" : undefined}
						onClick={() => select(folder.id)}
						onKeyDown={folderKeyHandler(folder, nav.folderActions)}
						className="min-w-0 flex-1 bg-transparent pl-1 hover:bg-transparent active:bg-transparent data-active:bg-transparent"
					>
						<span>{folder.name}</span>
					</SidebarMenuButton>
					<MoreActionsButton
						actions={actions}
						label={t("list.folderActions", { name: folder.name })}
						className="size-6 shrink-0 text-cms-sidebar-foreground/70"
					/>
				</ActionContextMenu>
				{children.length > 0 && (
					<CollapsibleContent>
						<SidebarMenuSub className={cn(TREE_LIST, "ml-0")}>{children.map(renderFolder)}</SidebarMenuSub>
					</CollapsibleContent>
				)}
			</Collapsible>
		);
	};

	const label = site.COLLECTION_DEFINITIONS[nav.collection].label;
	const blankActions: MenuAction[] = [
		{
			kind: "item",
			label: t("list.folderAdd"),
			icon: FolderPlus,
			onSelect: () => nav.folderActions.requestCreate(null),
		},
		{ kind: "item", label: t("list.add", { label }), icon: Plus, onSelect: nav.onCreateEntry },
	];

	return (
		<SidebarGroup className="flex-1 group-data-[collapsible=icon]:hidden">
			<SidebarGroupLabel>{t("sidebar.folders")}</SidebarGroupLabel>
			<IconButton
				label={t("list.folderAdd")}
				side="right"
				size="icon-xs"
				className="absolute top-3.5 right-3 size-5 text-cms-sidebar-foreground hover:bg-cms-sidebar-accent hover:text-cms-sidebar-accent-foreground group-data-[collapsible=icon]:hidden [&_svg]:size-4"
				onClick={() => nav.folderActions.requestCreate(null)}
			>
				<Plus aria-hidden />
			</IconButton>
			<SidebarGroupContent className="flex flex-1 flex-col">
				<SidebarMenu>
					<SidebarMenuItem>
						<ActionContextMenu actions={blankActions} trigger={<div />}>
							<SidebarMenuButton
								size="sm"
								{...dropProps("root", null)}
								isActive={currentFolder === "all"}
								aria-current={currentFolder === "all" ? "true" : undefined}
								onClick={() => select("all")}
								className={cn(dropTarget === "root" && "ring-2 ring-cms-sidebar-ring")}
							>
								<CollectionIcon collection={nav.collection} />
								<span>{label}</span>
							</SidebarMenuButton>
						</ActionContextMenu>
						{folders.length > 0 && (
							<SidebarMenuSub aria-label={t("sidebar.folderTree", { label })} className={cn(TREE_LIST, "ml-1")}>
								{folders.filter((f) => !f.parentId).map(renderFolder)}
							</SidebarMenuSub>
						)}
					</SidebarMenuItem>
				</SidebarMenu>
				{folders.length === 0 && (
					<p className="px-2 py-2 text-cms-muted-foreground text-xs">{t("sidebar.noFolders")}</p>
				)}
				{folders.length > 0 && (
					<Label className="mt-3 px-2 font-normal text-cms-muted-foreground text-xs">
						<Switch
							size="sm"
							checked={nav.includeDescendants}
							onCheckedChange={(checked) => nav.onIncludeDescendantsChange(checked === true)}
						/>
						{t("sidebar.includeDescendants")}
					</Label>
				)}
				{/* Right-click menu for empty space. Attached only to the empty area below the list so it does not overlap folder row menus. */}
				<ActionContextMenu actions={blankActions} trigger={<div aria-hidden className="min-h-16 flex-1" />} />
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

/** Left navigation area: collections, media/templates/trash, virtual folder tree. */
export function AdminSidebar({ activeNav, folderNav, trashCount }: AdminSidebarProps) {
	const site = useSite();
	// Sidebar items added by a plugin (`plugins[].nav` in site settings).
	const pluginNav = useMemo(() => site.plugins.flatMap((plugin) => plugin.nav ?? []), [site]);
	const t = useTranslator(screensMessages);
	const { isMobile, setOpenMobile, state } = useSidebar();
	const features = useAdminFeatures();
	const toggleLabel = isMobile
		? t("sidebar.close")
		: state === "collapsed"
			? t("sidebar.expand")
			: t("sidebar.collapse");
	const closeMobile = () => {
		if (isMobile) setOpenMobile(false);
	};

	const navLink = (href: string, id: AdminNavId, label: string, icon?: React.ReactNode, badge?: React.ReactNode) => (
		<SidebarMenuItem key={id}>
			<SidebarMenuButton
				isActive={activeNav === id}
				tooltip={label}
				render={<Link href={href} onClick={closeMobile} aria-current={activeNav === id ? "page" : undefined} />}
			>
				{icon}
				<span>{label}</span>
			</SidebarMenuButton>
			{badge}
		</SidebarMenuItem>
	);

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader className="flex-row items-center gap-1 px-3 pt-3.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
				<Link
					href={site.adminHref()}
					onClick={closeMobile}
					className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1 group-data-[collapsible=icon]:hidden"
				>
					<span
						aria-hidden
						className="flex size-6 items-center justify-center rounded-md bg-cms-sidebar-primary font-semibold text-cms-sidebar-primary-foreground text-xs"
					>
						{(site.SITE_NAME || "CMS").slice(0, 1)}
					</span>
					<span className="font-semibold text-[13px] text-cms-sidebar-accent-foreground">
						{site.SITE_NAME || "CMS"}
					</span>
				</Link>
				<Tooltip>
					<TooltipTrigger
						render={
							<SidebarTrigger aria-label={toggleLabel} className="size-8 shrink-0 text-cms-sidebar-foreground/70" />
						}
					/>
					<TooltipContent side="right">{toggleLabel}</TooltipContent>
				</Tooltip>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>{t("sidebar.collections")}</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu aria-label={t("sidebar.collections")}>
							{site.COLLECTIONS.map((collection) =>
								navLink(
									site.adminHref(`?collection=${collection}`),
									collection,
									site.COLLECTION_DEFINITIONS[collection].label,
									<CollectionIcon collection={collection} />,
								),
							)}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupLabel>{t("sidebar.manage")}</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu aria-label={t("sidebar.manage")}>
							{features.media && navLink(site.adminHref("/media"), "media", t("sidebar.media"), <FileImage />)}
							{navLink(site.adminHref("/templates"), "templates", t("sidebar.templates"), <LayoutTemplate />)}
							{navLink(site.adminHref("/schema"), "schema", t("sidebar.schema"), <Settings2 />)}
							{pluginNav.map((item) =>
								navLink(site.adminHref(`/${item.path}`), item.path, item.label, <NamedIcon name={item.icon} />),
							)}
							{navLink(
								site.adminHref("/trash"),
								"trash",
								t("sidebar.trash"),
								<Trash2 />,
								trashCount ? (
									<SidebarMenuBadge aria-label={t("sidebar.trashBadge", { count: trashCount })}>
										{trashCount}
									</SidebarMenuBadge>
								) : null,
							)}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				{folderNav && <FolderTree nav={folderNav} closeMobile={closeMobile} />}
			</SidebarContent>
			<SidebarFooter className="flex-row items-center gap-1 border-cms-sidebar-border border-t px-3 py-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-2">
				{/* Site home (`site.home`, default `/`). The admin screen lives inside the site app, so `/` is the site. */}
				<Tooltip>
					<TooltipTrigger
						render={
							<Link
								href={site.SITE_HOME}
								aria-label={t("sidebar.viewSite")}
								className="flex h-8 flex-1 items-center gap-2 rounded-md px-2 text-[13px] text-cms-muted-foreground hover:bg-cms-sidebar-accent hover:text-cms-sidebar-accent-foreground group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
							/>
						}
					>
						<Globe aria-hidden className="size-4" />
						<span className="group-data-[collapsible=icon]:hidden">{t("sidebar.viewSite")}</span>
					</TooltipTrigger>
					<TooltipContent side="right" hidden={state !== "collapsed" || isMobile}>
						{t("sidebar.viewSite")}
					</TooltipContent>
				</Tooltip>
				<ThemeToggle className="size-8 text-cms-muted-foreground" />
			</SidebarFooter>
		</Sidebar>
	);
}
