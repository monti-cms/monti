"use client";

import {
	Activity,
	ChevronRight,
	DataBase,
	Edit,
	FolderAdd,
	Folder as FolderIcon,
	Globe,
	Image,
	Launch,
	Password,
	SettingsAdjust,
	Template,
	TrashCan,
} from "@carbon/icons-react";
import type { Folder } from "@monti-cms/core/site";
import { type Collection, useSite, useTranslator } from "@monti-cms/core/site";
import { Caret, IconButton, Tooltip, TooltipContent, TooltipTrigger } from "@monti-cms/ui";
import {
	cn,
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarTrigger,
	useSidebar,
} from "@monti-cms/ui/internal";
import { Fragment, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { commonMessages } from "../lib/common.messages";
import { booleanCodec, usePreference } from "../lib/hooks/use-preference";
import { AdminLink as Link } from "../router";
import { ThemeToggle } from "../ui/theme-toggle";
import { screensMessages } from "./messages";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "./shared/action-menu";
import { useAdminFeatures } from "./shared/admin-features";
import { CollectionIcon, NamedIcon } from "./shared/collection-icon";
import { type DraggedEntry, isEntryDrag, readDraggedEntries } from "./shared/entry-drag";
import type { FolderActions } from "./shared/use-folder-actions";
import { type ToolsPage, toolsPages } from "./tools/tools-pages";

/** Value that points to the current screen in the sidebar. Every Settings tab is the one `settings` entry; a plugin page is `tools:<path>`. */
export type AdminNavId =
	| Collection
	| "media"
	| "templates"
	| "api-keys"
	| "data"
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
	"group/row relative flex min-h-[30px] items-center gap-monti-4 rounded-monti-md pr-monti-4 text-monti-muted text-monti-note hover:text-monti-default data-active:font-semibold data-active:text-monti-default";

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
				icon: FolderAdd,
				onSelect: () => startCreating(folder.id),
			},
			{
				kind: "item",
				label: tc("rename"),
				icon: Edit,
				onSelect: () => startRenaming(folder),
			},
			{ kind: "separator" },
			{
				kind: "item",
				label: tc("delete"),
				icon: TrashCan,
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
							className={cn(subRow, dropTarget === folder.id && "ring-2 ring-monti-contrast")}
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
							className="flex size-4 shrink-0 items-center justify-center rounded-monti-sm text-monti-muted outline-hidden hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast"
						>
							<ChevronRight aria-hidden className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")} />
						</button>
					) : (
						<span aria-hidden className="size-4 shrink-0" />
					)}
					<FolderIcon aria-hidden className="size-3.5 shrink-0 text-monti-muted" />
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
							className="h-6 min-w-0 flex-1 rounded-monti-md bg-monti-page px-monti-8 text-monti-default text-monti-label outline-hidden ring-1 ring-monti-default focus:ring-2 focus:ring-monti-contrast"
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
							className="h-full min-w-0 flex-1 truncate rounded-monti-sm text-left outline-hidden focus-visible:ring-2 focus-visible:ring-monti-contrast"
						>
							{folder.name}
						</button>
					)}
					<span className="shrink-0 opacity-0 focus-within:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100">
						<MoreActionsButton actions={actions} label={t("list.folderActions", { name: folder.name })} />
					</span>
				</ActionContextMenu>
				{isExpanded && (children.length > 0 || isCreatingChild) && (
					<ul className="flex flex-col gap-monti-2">
						{isCreatingChild && (
							<li style={{ paddingLeft: TREE_INDENT + (depth + 1) * TREE_STEP }} className={cn(subRow, "pr-monti-8")}>
								<span aria-hidden className="size-4 shrink-0" />
								<FolderAdd aria-hidden className="size-3.5 shrink-0 text-monti-muted" />
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
									className="h-6 min-w-0 flex-1 rounded-monti-md bg-monti-page px-monti-8 text-monti-default text-monti-label outline-hidden ring-1 ring-monti-default focus:ring-2 focus:ring-monti-contrast"
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
		<ul aria-label={t("sidebar.folderTree", { label })} className="mt-monti-2 mb-monti-4 flex flex-col gap-monti-2">
			{folders.filter((f) => !f.parentId).map((folder) => renderFolder(folder, 0))}
		</ul>
	);
}

/** Left navigation area: Content (collections with their folders, media), Writing (templates, writing plugin pages), Site (data, API keys, event log, site plugin pages; collapsed by default), Trash, and Settings with the theme toggle pinned at the bottom. */
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
	// Folder trees folded away by hand, by scope.
	const [foldersHidden, setFoldersHidden] = useState<ReadonlySet<string>>(new Set());

	const navLink = (
		href: string,
		id: AdminNavId,
		label: string,
		icon?: React.ReactNode,
		toggle?: React.ReactNode,
		trailing?: React.ReactNode,
	) => {
		const isRootActive = activeNav === id && (folderNav?.currentFolder === "all" || !folderNav?.currentFolder);
		return (
			<SidebarMenuItem key={id}>
				<SidebarMenuButton
					isActive={isRootActive}
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
				{toggle}
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
		const showTree = nav !== undefined && nav.folders.length > 0;
		const treeHidden = foldersHidden.has(scope);
		const treeId = `monti-sidebar-folders-${scope}`;
		// The open screen's tree folds away with its own button; elsewhere the chevron only says "has folders".
		const toggle = showTree ? (
			<button
				type="button"
				aria-expanded={!treeHidden}
				aria-controls={treeId}
				aria-label={treeHidden ? t("sidebar.showFolders") : t("sidebar.hideFolders")}
				onClick={() =>
					setFoldersHidden((hidden) => {
						const next = new Set(hidden);
						if (!next.delete(scope)) next.add(scope);
						return next;
					})
				}
				data-sidebar="menu-action"
				className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-monti-sm text-monti-muted outline-hidden ring-monti-contrast hover:bg-monti-selected hover:text-monti-default focus-visible:ring-2"
			>
				<ChevronRight aria-hidden className={cn("size-3 transition-transform", !treeHidden && "rotate-90")} />
			</button>
		) : undefined;
		const chevron =
			!showTree && folderCount > 0 ? <ChevronRight aria-hidden className="size-3! text-monti-subtle" /> : null;
		return (
			<Fragment key={scope}>
				{navLink(href, scope, label, icon, toggle, chevron)}
				{showTree && (
					<SidebarMenuItem id={treeId} hidden={treeHidden}>
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

	const pages = toolsPages(site);
	const writingPages = pages.filter((page) => page.group === "writing");
	const sitePages = pages.filter((page) => page.group === "site");
	const pageLink = (page: ToolsPage) =>
		navLink(page.href, `tools:${page.path}`, page.label, <NamedIcon name={page.icon} />);
	// The Site group keeps the open state it was left in (remembered per browser) and opens by itself on arriving at one of its screens. It always
	// folds when asked, even with the open screen inside; the group label then stands out so the current place is still visible.
	const [siteOpenChoice, setSiteOpen] = usePreference("sidebar-site-open", booleanCodec, false);
	const siteNavIds: AdminNavId[] = [
		"data",
		"api-keys",
		"events",
		...sitePages.map((page): AdminNavId => `tools:${page.path}`),
	];
	const inSite = siteNavIds.includes(activeNav);
	// A fold or unfold on this screen; arriving at another screen drops it.
	const [siteToggle, setSiteToggle] = useState<{ nav: AdminNavId; open: boolean } | null>(null);
	const siteOpen = siteToggle?.nav === activeNav ? siteToggle.open : siteOpenChoice || inSite;
	const toggleSite = () => {
		setSiteToggle({ nav: activeNav, open: !siteOpen });
		setSiteOpen(!siteOpen);
	};

	const mediaEntry = () => entryWithFolders("media", site.adminHref("/media"), t("sidebar.media"), <Image />);

	return (
		<Sidebar>
			<SidebarHeader>
				<Link
					href={site.adminHref()}
					onClick={closeMobile}
					className="min-w-0 flex-1 truncate text-monti-default text-monti-title no-underline"
				>
					{site.SITE_NAME || "CMS"}
				</Link>
				{/* Site home (`site.home`, default `/`). The admin screen lives inside the site app, so `/` is the site. Opens in a new tab so the admin stays. */}
				<IconButton
					label={t("sidebar.viewSite")}
					side="right"
					nativeButton={false}
					render={<Link role="link" href={site.SITE_HOME} target="_blank" rel="noopener noreferrer" />}
				>
					<Launch aria-hidden />
				</IconButton>
				<Tooltip>
					<TooltipTrigger
						render={<SidebarTrigger aria-label={toggleLabel} className="size-8 shrink-0 text-monti-muted" />}
					/>
					<TooltipContent side="right">{toggleLabel}</TooltipContent>
				</Tooltip>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu aria-label={t("sidebar.content")}>
							{site.COLLECTIONS.map(collectionEntry)}
							{features.media && mediaEntry()}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu aria-label={t("sidebar.writing")}>
							{site.ADMIN_TEMPLATES &&
								navLink(site.adminHref("/templates"), "templates", t("sidebar.templates"), <Template />)}
							{writingPages.map(pageLink)}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup>
					{/* The fold is a row like the others; closed, the row stands for the place when the open screen is inside it. */}
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								type="button"
								isActive={!siteOpen && inSite}
								aria-expanded={siteOpen}
								aria-controls="monti-sidebar-site"
								onClick={toggleSite}
							>
								<Globe aria-hidden />
								<span className="flex-1">{t("sidebar.site")}</span>
								{!siteOpen && eventsCount ? (
									<output
										aria-label={t("sidebar.eventsBadge", { count: eventsCount })}
										className="font-mono font-normal text-monti-danger text-monti-meta"
									>
										{eventsCount}
									</output>
								) : null}
								<span aria-hidden className={cn("flex transition-transform", siteOpen && "rotate-180")}>
									<Caret solo ink />
								</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
					<SidebarGroupContent id="monti-sidebar-site" hidden={!siteOpen}>
						<SidebarMenu aria-label={t("sidebar.site")}>
							{navLink(site.adminHref("/data"), "data", t("sidebar.data"), <DataBase />)}
							{navLink(site.adminHref("/api-keys"), "api-keys", t("sidebar.apiKeys"), <Password />)}
							{navLink(
								site.adminHref("/events"),
								"events",
								t("sidebar.events"),
								<Activity />,
								undefined,
								eventsCount ? (
									<SidebarMenuBadge
										aria-label={t("sidebar.eventsBadge", { count: eventsCount })}
										className="text-monti-danger"
									>
										{eventsCount}
									</SidebarMenuBadge>
								) : null,
							)}
							{sitePages.map(pageLink)}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu aria-label={t("sidebar.trash")}>
					{navLink(
						site.adminHref("/trash"),
						"trash",
						t("sidebar.trash"),
						<TrashCan />,
						undefined,
						trashCount ? (
							<SidebarMenuBadge aria-label={t("sidebar.trashBadge", { count: trashCount })}>
								{trashCount}
							</SidebarMenuBadge>
						) : null,
					)}
				</SidebarMenu>
				<div className="flex items-center gap-monti-4">
					<SidebarMenu aria-label={t("sidebar.settings")} className="min-w-0 flex-1">
						{navLink(site.adminHref("/settings"), "settings", t("sidebar.settings"), <SettingsAdjust />)}
					</SidebarMenu>
					<ThemeToggle />
				</div>
			</SidebarFooter>
		</Sidebar>
	);
}
