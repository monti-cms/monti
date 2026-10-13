"use client";

import { type Collection, useSite, useTranslator } from "@monti-cms/core/client";
import type { Folder } from "@monti-cms/core/runtime";
import {
	Activity,
	ChevronDown,
	ChevronRight,
	ExternalLink,
	FileImage,
	KeyRound,
	LayoutTemplate,
	Plus,
	Settings2,
	Trash2,
} from "lucide-react";
import { Fragment, type KeyboardEvent, useEffect, useState } from "react";
import { commonMessages } from "../lib/common.messages";
import { cn } from "../lib/utils/cn";
import { AdminLink as Link } from "../router";
import { buttonVariants } from "../ui/button";
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
	SidebarSeparator,
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
import { toolsPages } from "./tools/tools-pages";

/** Value that points to the current screen in the sidebar. Every Settings tab is the one `settings` entry; a plugin page is `tools:<path>`. */
export type AdminNavId =
	| Collection
	| "media"
	| "templates"
	| "api-keys"
	| "events"
	| "settings"
	| "trash"
	| `tools:${string}`;

/** Folder navigation, passed by the list screen. The sidebar draws it as a tree under the collection it belongs to. */
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
	/** Failed and dead event deliveries: shown on the Event log entry. */
	eventsCount?: number | null;
	/** Folders per collection, so a collection that has some shows a chevron even while it is not the open one. */
	folderCounts?: Readonly<Record<string, number>>;
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

/** Left padding of the first level of the folder tree, so its labels line up under the collection name. */
const TREE_INDENT = 36;
const TREE_STEP = 16;
const subRow =
	"group/row flex h-7 items-center gap-1 rounded-md pr-1 text-[13px] text-cms-sidebar-foreground/80 hover:bg-cms-sidebar-accent hover:text-cms-sidebar-accent-foreground data-active:bg-cms-sidebar-accent data-active:font-medium data-active:text-cms-sidebar-accent-foreground";

/** The folders of the open collection, drawn under its entry: All, the folders (nested), then Add folder. */
function FolderTree({ nav, closeMobile }: { nav: FolderNavigation; closeMobile: () => void }) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const tc = useTranslator(commonMessages);
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

	const renderFolder = (folder: Folder, depth: number) => {
		const children = folders.filter((f) => f.parentId === folder.id);
		const isExpanded = expandedIds.has(folder.id);
		const isActive = currentFolder === folder.id;
		const actions = folderMenuActions(site, folder, nav.folders, nav.folderActions);
		return (
			<li key={folder.id}>
				<ActionContextMenu
					actions={actions}
					trigger={
						<div
							{...dropProps(folder.id, folder.id)}
							data-active={isActive || undefined}
							style={{ paddingLeft: TREE_INDENT + depth * TREE_STEP }}
							className={cn(subRow, dropTarget === folder.id && "ring-2 ring-cms-sidebar-ring")}
						/>
					}
				>
					{children.length > 0 ? (
						<button
							type="button"
							aria-label={t(isExpanded ? "sidebar.folderCollapse" : "sidebar.folderExpand", { name: folder.name })}
							aria-expanded={isExpanded}
							onClick={() =>
								setExpandedIds((prev) => {
									const next = new Set(prev);
									if (isExpanded) next.delete(folder.id);
									else next.add(folder.id);
									return next;
								})
							}
							className="flex size-4 shrink-0 items-center justify-center rounded-sm text-cms-sidebar-foreground/60 outline-hidden hover:text-cms-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-cms-sidebar-ring"
						>
							<ChevronRight aria-hidden className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")} />
						</button>
					) : (
						<span aria-hidden className="size-4 shrink-0" />
					)}
					<button
						type="button"
						aria-current={isActive ? "true" : undefined}
						onClick={() => select(folder.id)}
						onKeyDown={folderKeyHandler(folder, nav.folderActions)}
						className="h-full min-w-0 flex-1 truncate rounded-sm text-left outline-hidden focus-visible:ring-2 focus-visible:ring-cms-sidebar-ring"
					>
						{folder.name}
					</button>
					<MoreActionsButton
						actions={actions}
						label={t("list.folderActions", { name: folder.name })}
						className="size-5 shrink-0 text-cms-sidebar-foreground/70 opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100 data-popup-open:opacity-100"
					/>
				</ActionContextMenu>
				{isExpanded && children.length > 0 && (
					<ul className="flex flex-col gap-0.5">{children.map((child) => renderFolder(child, depth + 1))}</ul>
				)}
			</li>
		);
	};

	const label = site.COLLECTION_DEFINITIONS[nav.collection].label;
	const blankActions: MenuAction[] = [
		{
			kind: "item",
			label: tc("addFolder"),
			icon: Plus,
			onSelect: () => nav.folderActions.requestCreate(null),
		},
		{ kind: "item", label: t("list.add", { label }), icon: Plus, onSelect: nav.onCreateEntry },
	];

	return (
		<ul
			aria-label={t("sidebar.folderTree", { label })}
			className="mt-0.5 mb-1 flex flex-col gap-0.5 group-data-[collapsible=icon]:hidden"
		>
			{folders.length > 0 && (
				<li>
					<ActionContextMenu actions={blankActions} trigger={<div />}>
						<button
							type="button"
							{...dropProps("root", null)}
							data-active={currentFolder === "all" || undefined}
							aria-current={currentFolder === "all" ? "true" : undefined}
							onClick={() => select("all")}
							style={{ paddingLeft: TREE_INDENT }}
							className={cn(subRow, "w-full text-left", dropTarget === "root" && "ring-2 ring-cms-sidebar-ring")}
						>
							{t("sidebar.folderAll")}
						</button>
					</ActionContextMenu>
				</li>
			)}
			{folders.filter((f) => !f.parentId).map((folder) => renderFolder(folder, 0))}
			<li>
				<button
					type="button"
					onClick={() => nav.folderActions.requestCreate(null)}
					style={{ paddingLeft: TREE_INDENT }}
					className={cn(subRow, "w-full text-left text-cms-sidebar-foreground/50")}
				>
					<Plus aria-hidden className="size-3.5" />
					{tc("addFolder")}
				</button>
			</li>
			{folders.length > 0 && (
				<li>
					<Label
						className="gap-2 py-1 font-normal text-cms-sidebar-foreground/60 text-xs"
						style={{ paddingLeft: TREE_INDENT }}
					>
						<Switch
							size="sm"
							checked={nav.includeDescendants}
							onCheckedChange={(checked) => nav.onIncludeDescendantsChange(checked === true)}
						/>
						{t("sidebar.includeDescendants")}
					</Label>
				</li>
			)}
		</ul>
	);
}

/** Left navigation area: Content (collections with their folders, media), Tools (templates, plugin pages, API keys, event log), Trash, and Settings with the theme toggle pinned at the bottom. */
export function AdminSidebar({ activeNav, folderNav, trashCount, eventsCount, folderCounts }: AdminSidebarProps) {
	const site = useSite();
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

	const navLink = (
		href: string,
		id: AdminNavId,
		label: string,
		icon?: React.ReactNode,
		badge?: React.ReactNode,
		trailing?: React.ReactNode,
	) => (
		<SidebarMenuItem key={id}>
			<SidebarMenuButton
				isActive={activeNav === id}
				tooltip={label}
				render={<Link href={href} onClick={closeMobile} aria-current={activeNav === id ? "page" : undefined} />}
			>
				{icon}
				<span className="flex-1">{label}</span>
				{trailing}
			</SidebarMenuButton>
			{badge}
		</SidebarMenuItem>
	);

	const collectionEntry = (collection: Collection) => {
		const active = activeNav === collection;
		const nav = active && folderNav?.collection === collection ? folderNav : undefined;
		const folderCount = nav ? nav.folders.length : (folderCounts?.[collection] ?? 0);
		const chevron =
			folderCount > 0 ? (
				active ? (
					<ChevronDown
						aria-hidden
						className="size-3! text-cms-sidebar-foreground/60 group-data-[collapsible=icon]:hidden"
					/>
				) : (
					<ChevronRight
						aria-hidden
						className="size-3! text-cms-sidebar-foreground/50 group-data-[collapsible=icon]:hidden"
					/>
				)
			) : null;
		return (
			<Fragment key={collection}>
				{navLink(
					site.adminHref(`?collection=${collection}`),
					collection,
					site.COLLECTION_DEFINITIONS[collection].label,
					<CollectionIcon collection={collection} />,
					undefined,
					chevron,
				)}
				{nav && (
					<SidebarMenuItem>
						<FolderTree nav={nav} closeMobile={closeMobile} />
					</SidebarMenuItem>
				)}
			</Fragment>
		);
	};

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader className="flex-row items-center gap-1 px-3 pt-3.5 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
				<Link
					href={site.adminHref()}
					onClick={closeMobile}
					className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1 group-data-[collapsible=icon]:hidden"
				>
					<span
						aria-hidden
						className="flex size-6 shrink-0 items-center justify-center rounded-md bg-cms-sidebar-primary font-semibold text-cms-sidebar-primary-foreground text-xs"
					>
						{(site.SITE_NAME || "CMS").slice(0, 1)}
					</span>
					<span className="truncate font-semibold text-[13px] text-cms-sidebar-accent-foreground">
						{site.SITE_NAME || "CMS"}
					</span>
				</Link>
				{/* Site home (`site.home`, default `/`). The admin screen lives inside the site app, so `/` is the site. Opens in a new tab so the admin stays. */}
				<Tooltip>
					<TooltipTrigger
						render={
							<Link
								href={site.SITE_HOME}
								target="_blank"
								rel="noopener noreferrer"
								aria-label={t("sidebar.viewSite")}
								className={cn(
									buttonVariants({ variant: "ghost", size: "icon-sm" }),
									"size-8 shrink-0 text-cms-sidebar-foreground/70",
								)}
							/>
						}
					>
						<ExternalLink aria-hidden className="size-4" />
					</TooltipTrigger>
					<TooltipContent side="right">{t("sidebar.viewSite")}</TooltipContent>
				</Tooltip>
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
					<SidebarGroupLabel>{t("sidebar.content")}</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu aria-label={t("sidebar.content")}>
							{site.COLLECTIONS.map(collectionEntry)}
							{features.media && navLink(site.adminHref("/media"), "media", t("sidebar.media"), <FileImage />)}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup className="pt-0">
					<SidebarGroupLabel>{t("sidebar.tools")}</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu aria-label={t("sidebar.tools")}>
							{site.ADMIN_TEMPLATES &&
								navLink(site.adminHref("/templates"), "templates", t("sidebar.templates"), <LayoutTemplate />)}
							{toolsPages(site).map((page) =>
								navLink(page.href, `tools:${page.path}`, page.label, <NamedIcon name={page.icon} />),
							)}
							{navLink(site.adminHref("/api-keys"), "api-keys", t("sidebar.apiKeys"), <KeyRound />)}
							{navLink(
								site.adminHref("/events"),
								"events",
								t("sidebar.events"),
								<Activity />,
								eventsCount ? (
									<SidebarMenuBadge
										aria-label={t("sidebar.eventsBadge", { count: eventsCount })}
										className="text-cms-destructive"
									>
										{eventsCount}
									</SidebarMenuBadge>
								) : null,
							)}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarSeparator />
				<SidebarGroup className="pt-0">
					<SidebarGroupContent>
						<SidebarMenu aria-label={t("sidebar.trash")}>
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
			</SidebarContent>
			<SidebarFooter className="flex-row items-center gap-1 border-cms-sidebar-border border-t px-2 py-2 group-data-[collapsible=icon]:flex-col">
				<SidebarMenu aria-label={t("sidebar.settings")} className="min-w-0 flex-1">
					{navLink(site.adminHref("/settings"), "settings", t("sidebar.settings"), <Settings2 />)}
				</SidebarMenu>
				<ThemeToggle className="size-8 shrink-0 text-cms-muted-foreground" />
			</SidebarFooter>
		</Sidebar>
	);
}
