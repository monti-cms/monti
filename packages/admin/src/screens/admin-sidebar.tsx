"use client";

import type { Folder } from "@monti-cms/core/site";
import { type Collection, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Activity,
	ChevronDown,
	ChevronRight,
	ExternalLink,
	FileImage,
	Folder as FolderIcon,
	FolderPlus,
	KeyRound,
	LayoutTemplate,
	Pencil,
	Settings2,
	Trash2,
} from "lucide-react";
import { Fragment, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { commonMessages } from "../lib/common.messages";
import { cn } from "../lib/utils/cn";
import { AdminLink as Link } from "../router";
import { buttonVariants } from "../ui/button";
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
import { ThemeToggle } from "../ui/theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { screensMessages } from "./messages";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "./shared/action-menu";
import { useAdminFeatures } from "./shared/admin-features";
import { CollectionIcon, NamedIcon } from "./shared/collection-icon";
import { type DraggedEntry, isEntryDrag, readDraggedEntries } from "./shared/entry-drag";
import type { FolderActions } from "./shared/use-folder-actions";
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
	collection: Collection | "media";
	/** `all` (top level) or a folder ID. */
	currentFolder: string;
	includeDescendants?: boolean;
	folders: Folder[];
	folderActions: FolderActions;
	onSelectFolder: (folder: string) => void;
	onIncludeDescendantsChange?: (value: boolean) => void;
	/** When a list row is dragged and dropped onto a folder (or the top level). */
	onDropEntries: (folderId: string | null, entries: DraggedEntry[]) => void;
	onCreateEntry?: () => void;
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
const TREE_INDENT = 8;
const TREE_STEP = 16;
const subRow =
	"group/row flex h-7 items-center gap-1 rounded-md pr-1 text-[13px] text-monti-sidebar-foreground/80 hover:bg-monti-sidebar-accent hover:text-monti-sidebar-accent-foreground data-active:bg-monti-sidebar-accent data-active:font-medium data-active:text-monti-sidebar-accent-foreground";

/** The folders of the open collection, drawn under its entry: All, the folders (nested), then Add folder. */
function FolderTree({ nav, closeMobile }: { nav: FolderNavigation; closeMobile: () => void }) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const tc = useTranslator(commonMessages);
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
	const [dropTarget, setDropTarget] = useState<string | null>(null);
	const [creatingUnderId, setCreatingUnderId] = useState<string | null>(null);
	const [createValue, setCreateValue] = useState("");
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const createInputRef = useRef<HTMLInputElement>(null);
	const renameInputRef = useRef<HTMLInputElement>(null);
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

	useEffect(() => {
		if (renamingId && renameInputRef.current) {
			renameInputRef.current.focus();
			renameInputRef.current.select();
		}
	}, [renamingId]);

	useEffect(() => {
		if (creatingUnderId && createInputRef.current) {
			createInputRef.current.focus();
		}
	}, [creatingUnderId]);

	const select = (folder: string) => {
		nav.onSelectFolder(folder);
		closeMobile();
	};

	const startCreating = (parentId: string) => {
		setRenamingId(null);
		setExpandedIds((prev) => new Set(prev).add(parentId));
		setCreatingUnderId(parentId);
		setCreateValue("");
	};

	const cancelCreate = () => {
		setCreatingUnderId(null);
		setCreateValue("");
	};

	const commitCreate = async () => {
		const trimmed = createValue.trim();
		const parentId = creatingUnderId;
		setCreatingUnderId(null);
		setCreateValue("");
		if (!trimmed || !parentId) return;
		try {
			await nav.folderActions.createFolderDirect(trimmed, parentId);
		} catch {
			// Mutation handles error toast
		}
	};

	const startRenaming = (folder: Folder) => {
		setCreatingUnderId(null);
		setRenamingId(folder.id);
		setRenameValue(folder.name);
	};

	const cancelRename = () => {
		setRenamingId(null);
		setRenameValue("");
	};

	const commitRename = async (folder: Folder) => {
		const trimmed = renameValue.trim();
		setRenamingId(null);
		setRenameValue("");
		if (!trimmed || trimmed === folder.name) return;
		try {
			await nav.folderActions.renameFolderDirect(folder, trimmed);
		} catch {
			// Mutation handles error toast
		}
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
		const isRenaming = renamingId === folder.id;
		const isCreatingChild = creatingUnderId === folder.id;
		const actions: MenuAction[] = [
			{
				kind: "item",
				label: tc("addSubfolder"),
				icon: FolderPlus,
				onSelect: () => startCreating(folder.id),
			},
			{
				kind: "item",
				label: tc("rename"),
				icon: Pencil,
				onSelect: () => startRenaming(folder),
			},
			{ kind: "separator" },
			{
				kind: "item",
				label: tc("delete"),
				icon: Trash2,
				destructive: true,
				onSelect: () => void nav.folderActions.requestDelete(folder),
			},
		];

		return (
			<li key={folder.id}>
				<ActionContextMenu
					actions={actions}
					trigger={
						<div
							{...dropProps(folder.id, folder.id)}
							data-active={isActive || undefined}
							style={{ paddingLeft: TREE_INDENT + depth * TREE_STEP }}
							className={cn(subRow, dropTarget === folder.id && "ring-2 ring-monti-sidebar-ring")}
						/>
					}
				>
					{children.length > 0 || isCreatingChild ? (
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
							className="flex size-4 shrink-0 items-center justify-center rounded-sm text-monti-sidebar-foreground/60 outline-hidden hover:text-monti-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-monti-sidebar-ring"
						>
							<ChevronRight aria-hidden className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")} />
						</button>
					) : (
						<span aria-hidden className="size-4 shrink-0" />
					)}
					<FolderIcon aria-hidden className="size-3.5 shrink-0 text-monti-sidebar-foreground/60" />
					{isRenaming ? (
						<input
							ref={renameInputRef}
							type="text"
							value={renameValue}
							maxLength={100}
							onChange={(e) => setRenameValue(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									if (e.nativeEvent.isComposing || e.keyCode === 229) return;
									e.preventDefault();
									void commitRename(folder);
								} else if (e.key === "Escape") {
									e.preventDefault();
									cancelRename();
								}
							}}
							onBlur={() => {
								void commitRename(folder);
							}}
							onClick={(e) => e.stopPropagation()}
							className="h-6 min-w-0 flex-1 rounded bg-monti-background px-1.5 text-[13px] text-monti-foreground outline-hidden ring-1 ring-monti-input focus:ring-2 focus:ring-monti-ring"
						/>
					) : (
						<button
							type="button"
							aria-current={isActive ? "true" : undefined}
							onClick={() => select(folder.id)}
							onKeyDown={(e) => {
								if (e.key === "F2") {
									e.preventDefault();
									startRenaming(folder);
								} else if (e.key === "Delete") {
									e.preventDefault();
									void nav.folderActions.requestDelete(folder);
								}
							}}
							className="h-full min-w-0 flex-1 truncate rounded-sm text-left outline-hidden focus-visible:ring-2 focus-visible:ring-monti-sidebar-ring"
						>
							{folder.name}
						</button>
					)}
					<MoreActionsButton
						actions={actions}
						label={t("list.folderActions", { name: folder.name })}
						className="size-5 shrink-0 text-monti-sidebar-foreground/70 opacity-0 focus-visible:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100 data-popup-open:opacity-100 [@media(hover:none)]:opacity-100"
					/>
				</ActionContextMenu>
				{isExpanded && (children.length > 0 || isCreatingChild) && (
					<ul className="flex flex-col gap-0.5">
						{isCreatingChild && (
							<li style={{ paddingLeft: TREE_INDENT + (depth + 1) * TREE_STEP }} className={cn(subRow, "pr-2")}>
								<span aria-hidden className="size-4 shrink-0" />
								<FolderPlus aria-hidden className="size-3.5 shrink-0 text-monti-sidebar-foreground/60" />
								<input
									ref={createInputRef}
									type="text"
									value={createValue}
									placeholder={tc("addSubfolder")}
									maxLength={100}
									onChange={(e) => setCreateValue(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											if (e.nativeEvent.isComposing || e.keyCode === 229) return;
											e.preventDefault();
											void commitCreate();
										} else if (e.key === "Escape") {
											e.preventDefault();
											cancelCreate();
										}
									}}
									onBlur={() => {
										void commitCreate();
									}}
									className="h-6 min-w-0 flex-1 rounded bg-monti-background px-1.5 text-[13px] text-monti-foreground outline-hidden ring-1 ring-monti-input focus:ring-2 focus:ring-monti-ring"
								/>
							</li>
						)}
						{children.map((child) => renderFolder(child, depth + 1))}
					</ul>
				)}
			</li>
		);
	};

	if (folders.length === 0) return null;

	const label = site.isCollection(nav.collection)
		? site.COLLECTION_DEFINITIONS[nav.collection].label
		: t("sidebar.media");

	return (
		<ul
			aria-label={t("sidebar.folderTree", { label })}
			className="mt-0.5 mb-1 flex flex-col gap-0.5 group-data-[collapsible=icon]:hidden"
		>
			{folders.filter((f) => !f.parentId).map((folder) => renderFolder(folder, 0))}
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
	) => {
		const isRootActive = activeNav === id && (folderNav?.currentFolder === "all" || !folderNav?.currentFolder);
		return (
			<SidebarMenuItem key={id}>
				<SidebarMenuButton
					isActive={isRootActive}
					tooltip={label}
					render={
						<Link
							href={href}
							onClick={() => {
								if (folderNav && activeNav === id) {
									folderNav.onSelectFolder("all");
								}
								closeMobile();
							}}
							aria-current={isRootActive ? "page" : undefined}
						/>
					}
				>
					{icon}
					<span className="flex-1">{label}</span>
					{trailing}
				</SidebarMenuButton>
				{badge}
			</SidebarMenuItem>
		);
	};

	/**
	 * A nav link with its folder tree. The tree shows under the open screen when that screen passes `folderNav`, which it does only where it shows
	 * folders; the chevron counts the folders the shell fetched, which it does only for scopes that use them (`site.foldersEnabled`).
	 */
	const entryWithFolders = (scope: string, href: string, label: string, icon: React.ReactNode) => {
		const active = activeNav === scope;
		const nav = active && folderNav?.collection === scope ? folderNav : undefined;
		const folderCount = nav ? nav.folders.length : (folderCounts?.[scope] ?? 0);
		const chevron =
			folderCount > 0 ? (
				active ? (
					<ChevronDown
						aria-hidden
						className="size-3! text-monti-sidebar-foreground/60 group-data-[collapsible=icon]:hidden"
					/>
				) : (
					<ChevronRight
						aria-hidden
						className="size-3! text-monti-sidebar-foreground/50 group-data-[collapsible=icon]:hidden"
					/>
				)
			) : null;
		return (
			<Fragment key={scope}>
				{navLink(href, scope, label, icon, undefined, chevron)}
				{nav && nav.folders.length > 0 && (
					<SidebarMenuItem>
						<FolderTree nav={nav} closeMobile={closeMobile} />
					</SidebarMenuItem>
				)}
			</Fragment>
		);
	};

	const collectionEntry = (collection: Collection) =>
		entryWithFolders(
			collection,
			site.adminHref(`?collection=${collection}`),
			site.COLLECTION_DEFINITIONS[collection].label,
			<CollectionIcon collection={collection} />,
		);

	const mediaEntry = () => entryWithFolders("media", site.adminHref("/media"), t("sidebar.media"), <FileImage />);

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
						className="flex size-6 shrink-0 items-center justify-center rounded-md bg-monti-sidebar-primary font-semibold text-monti-sidebar-primary-foreground text-xs"
					>
						{(site.SITE_NAME || "CMS").slice(0, 1)}
					</span>
					<span className="truncate font-semibold text-[13px] text-monti-sidebar-accent-foreground">
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
									"size-8 shrink-0 text-monti-sidebar-foreground/70",
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
							<SidebarTrigger aria-label={toggleLabel} className="size-8 shrink-0 text-monti-sidebar-foreground/70" />
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
							{features.media && mediaEntry()}
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
										className="text-monti-destructive"
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
			<SidebarFooter className="flex-row items-center gap-1 border-monti-sidebar-border border-t px-2 py-2 group-data-[collapsible=icon]:flex-col">
				<SidebarMenu aria-label={t("sidebar.settings")} className="min-w-0 flex-1">
					{navLink(site.adminHref("/settings"), "settings", t("sidebar.settings"), <Settings2 />)}
				</SidebarMenu>
				<ThemeToggle className="size-8 shrink-0 text-monti-muted-foreground" />
			</SidebarFooter>
		</Sidebar>
	);
}
