"use client";

import type { CmsPlugin } from "@monti-cms/core";
import {
	adminHref,
	COLLECTION_DEFINITIONS,
	COLLECTIONS,
	type Collection,
	cmsConfig,
	createTranslator,
	SITE_HOME,
	SITE_NAME,
} from "@monti-cms/core/client";
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
	Trash2,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { type KeyboardEvent, useEffect, useState } from "react";
import { cn } from "../lib/utils/cn";
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

const t = createTranslator(screensMessages);

/** 사이드바에서 지금 화면을 가리키는 값. 플러그인 화면은 그 화면 주소(`nav.path`, 예: `ai`)다. */
export type AdminNavId = Collection | "media" | "templates" | "trash" | (string & {});

/** 플러그인이 더한 사이드바 항목(사이트 설정의 `plugins[].nav`). */
const PLUGIN_NAV = ((cmsConfig.plugins ?? []) as readonly CmsPlugin[]).flatMap((plugin) => plugin.nav ?? []);

/** 목록 화면에서만 쓰는 폴더 탐색(§3.3). */
export interface FolderNavigation {
	collection: Collection;
	/** `all`(최상위)·폴더 ID. */
	currentFolder: string;
	includeDescendants: boolean;
	folders: Folder[];
	folderActions: FolderActions;
	onSelectFolder: (folder: string) => void;
	onIncludeDescendantsChange: (value: boolean) => void;
	/** 목록 행을 폴더(또는 최상위)로 끌어 놓았을 때. */
	onDropEntries: (folderId: string | null, entries: DraggedEntry[]) => void;
	onCreateEntry: () => void;
}

export interface AdminSidebarProps {
	activeNav: AdminNavId;
	folderNav?: FolderNavigation;
	trashCount?: number | null;
}

/** 파일 탐색기처럼 F2는 이름 변경, Delete는 삭제(확인 대화상자)를 연다. */
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
 * 트리 연결선. 각 줄 왼쪽에 세로선과 `ㄴ`자 가로선을 그리고, 마지막 줄의 세로선은 가로선에서 끊는다.
 * 줄 높이(28px)의 절반인 14px에 가로선을 둔다. 세로선은 부모 폴더 아이콘(또는 최상위 아이콘) 가운데에 온다.
 */
const TREE_LIST = "mx-0 translate-x-0 gap-0 border-l-0 py-0 pr-0 pl-6";
const TREE_ITEM =
	"before:-left-3 after:-left-3 before:absolute before:top-0 before:h-full before:w-px before:bg-cms-sidebar-foreground/20 after:absolute after:top-3.5 after:h-px after:w-3.5 after:bg-cms-sidebar-foreground/20 last:before:h-3.5";

function FolderTree({ nav, closeMobile }: { nav: FolderNavigation; closeMobile: () => void }) {
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
	const [dropTarget, setDropTarget] = useState<string | null>(null);
	const { folders, currentFolder } = nav;

	// 선택한 폴더의 조상 경로를 펼친다.
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
		const actions = folderMenuActions(folder, nav.folders, nav.folderActions);
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
					{/* 폴더 아이콘이 펼침 단추를 겸한다. 하위 폴더가 있으면 올려 두거나 초점을 주면 화살표로 바뀐다. */}
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

	const label = COLLECTION_DEFINITIONS[nav.collection].label;
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
				{/* 빈 곳의 오른쪽 클릭 메뉴(v2 A2). 폴더 줄의 메뉴와 겹치지 않도록 목록 아래 빈 영역에만 붙인다. */}
				<ActionContextMenu actions={blankActions} trigger={<div aria-hidden className="min-h-16 flex-1" />} />
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

/** 왼쪽 탐색 영역(§3.1): 컬렉션, 미디어·템플릿·휴지통, 가상 폴더 트리(§3.3). */
export function AdminSidebar({ activeNav, folderNav, trashCount }: AdminSidebarProps) {
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
				render={
					<Link href={href as Route} onClick={closeMobile} aria-current={activeNav === id ? "page" : undefined} />
				}
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
					href={adminHref() as Route}
					onClick={closeMobile}
					className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1 group-data-[collapsible=icon]:hidden"
				>
					<span
						aria-hidden
						className="flex size-6 items-center justify-center rounded-md bg-cms-sidebar-primary font-semibold text-cms-sidebar-primary-foreground text-xs"
					>
						{(SITE_NAME || "CMS").slice(0, 1)}
					</span>
					<span className="font-semibold text-[13px] text-cms-sidebar-accent-foreground">{SITE_NAME || "CMS"}</span>
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
							{COLLECTIONS.map((collection) =>
								navLink(
									adminHref(`?collection=${collection}`),
									collection,
									COLLECTION_DEFINITIONS[collection].label,
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
							{features.media && navLink(adminHref("/media"), "media", t("sidebar.media"), <FileImage />)}
							{navLink(adminHref("/templates"), "templates", t("sidebar.templates"), <LayoutTemplate />)}
							{PLUGIN_NAV.map((item) =>
								navLink(adminHref(`/${item.path}`), item.path, item.label, <NamedIcon name={item.icon} />),
							)}
							{navLink(
								adminHref("/trash"),
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
				{/* 사이트 첫 화면(`site.home`, 기본 `/`). 관리자 화면이 사이트 앱 안에 있어 `/`가 사이트다. */}
				<Tooltip>
					<TooltipTrigger
						render={
							<Link
								href={SITE_HOME as Route}
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
