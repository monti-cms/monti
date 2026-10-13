"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { Activity, ChevronDown, ChevronRight, ExternalLink, FileImage, KeyRound, LayoutTemplate, Plus, Settings2, Trash2, } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { cn } from "../lib/utils/cn.js";
import { AdminLink as Link } from "../router/index.js";
import { buttonVariants } from "../ui/button.js";
import { Label } from "../ui/label.js";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarSeparator, SidebarTrigger, useSidebar, } from "../ui/sidebar.js";
import { Switch } from "../ui/switch.js";
import { ThemeToggle } from "../ui/theme-toggle.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip.js";
import { screensMessages } from "./messages.js";
import { toolsPages } from "./settings/tabs.js";
import { ActionContextMenu, MoreActionsButton } from "./shared/action-menu.js";
import { useAdminFeatures } from "./shared/admin-features.js";
import { CollectionIcon, NamedIcon } from "./shared/collection-icon.js";
import { isEntryDrag, readDraggedEntries } from "./shared/entry-drag.js";
import { folderMenuActions } from "./shared/use-folder-actions.js";
/** Like a file explorer: F2 opens rename, Delete opens delete (confirm dialog). */
export function folderKeyHandler(folder, actions) {
    return (event) => {
        if (event.key === "F2") {
            event.preventDefault();
            actions.requestRename(folder);
        }
        else if (event.key === "Delete") {
            event.preventDefault();
            void actions.requestDelete(folder);
        }
    };
}
/** Left padding of the first level of the folder tree, so its labels line up under the collection name. */
const TREE_INDENT = 36;
const TREE_STEP = 16;
const subRow = "group/row flex h-7 items-center gap-1 rounded-md pr-1 text-[13px] text-cms-sidebar-foreground/80 hover:bg-cms-sidebar-accent hover:text-cms-sidebar-accent-foreground data-active:bg-cms-sidebar-accent data-active:font-medium data-active:text-cms-sidebar-accent-foreground";
/** The folders of the open collection, drawn under its entry: All, the folders (nested), then Add folder. */
function FolderTree({ nav, closeMobile }) {
    const site = useSite();
    const t = useTranslator(screensMessages);
    const [expandedIds, setExpandedIds] = useState(new Set());
    const [dropTarget, setDropTarget] = useState(null);
    const { folders, currentFolder } = nav;
    // Expand the ancestor path of the selected folder.
    useEffect(() => {
        if (currentFolder === "all")
            return;
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
    const select = (folder) => {
        nav.onSelectFolder(folder);
        closeMobile();
    };
    const dropProps = (key, folderId) => ({
        onDragOver: (event) => {
            if (!isEntryDrag(event))
                return;
            event.preventDefault();
            setDropTarget(key);
        },
        onDragLeave: () => setDropTarget((current) => (current === key ? null : current)),
        onDrop: (event) => {
            event.preventDefault();
            setDropTarget(null);
            const entries = readDraggedEntries(event);
            if (entries.length > 0)
                nav.onDropEntries(folderId, entries);
        },
    });
    const renderFolder = (folder, depth) => {
        const children = folders.filter((f) => f.parentId === folder.id);
        const isExpanded = expandedIds.has(folder.id);
        const isActive = currentFolder === folder.id;
        const actions = folderMenuActions(site, folder, nav.folders, nav.folderActions);
        return (_jsxs("li", { children: [_jsxs(ActionContextMenu, { actions: actions, trigger: _jsx("div", { ...dropProps(folder.id, folder.id), "data-active": isActive || undefined, style: { paddingLeft: TREE_INDENT + depth * TREE_STEP }, className: cn(subRow, dropTarget === folder.id && "ring-2 ring-cms-sidebar-ring") }), children: [children.length > 0 ? (_jsx("button", { type: "button", "aria-label": t(isExpanded ? "sidebar.folderCollapse" : "sidebar.folderExpand", { name: folder.name }), "aria-expanded": isExpanded, onClick: () => setExpandedIds((prev) => {
                                const next = new Set(prev);
                                if (isExpanded)
                                    next.delete(folder.id);
                                else
                                    next.add(folder.id);
                                return next;
                            }), className: "flex size-4 shrink-0 items-center justify-center rounded-sm text-cms-sidebar-foreground/60 outline-hidden hover:text-cms-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-cms-sidebar-ring", children: _jsx(ChevronRight, { "aria-hidden": true, className: cn("size-3.5 transition-transform", isExpanded && "rotate-90") }) })) : (_jsx("span", { "aria-hidden": true, className: "size-4 shrink-0" })), _jsx("button", { type: "button", "aria-current": isActive ? "true" : undefined, onClick: () => select(folder.id), onKeyDown: folderKeyHandler(folder, nav.folderActions), className: "h-full min-w-0 flex-1 truncate rounded-sm text-left outline-hidden focus-visible:ring-2 focus-visible:ring-cms-sidebar-ring", children: folder.name }), _jsx(MoreActionsButton, { actions: actions, label: t("list.folderActions", { name: folder.name }), className: "size-5 shrink-0 text-cms-sidebar-foreground/70 opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100 data-popup-open:opacity-100" })] }), isExpanded && children.length > 0 && (_jsx("ul", { className: "flex flex-col gap-0.5", children: children.map((child) => renderFolder(child, depth + 1)) }))] }, folder.id));
    };
    const label = site.COLLECTION_DEFINITIONS[nav.collection].label;
    const blankActions = [
        {
            kind: "item",
            label: t("list.folderAdd"),
            icon: Plus,
            onSelect: () => nav.folderActions.requestCreate(null),
        },
        { kind: "item", label: t("list.add", { label }), icon: Plus, onSelect: nav.onCreateEntry },
    ];
    return (_jsxs("ul", { "aria-label": t("sidebar.folderTree", { label }), className: "mt-0.5 mb-1 flex flex-col gap-0.5 group-data-[collapsible=icon]:hidden", children: [folders.length > 0 && (_jsx("li", { children: _jsx(ActionContextMenu, { actions: blankActions, trigger: _jsx("div", {}), children: _jsx("button", { type: "button", ...dropProps("root", null), "data-active": currentFolder === "all" || undefined, "aria-current": currentFolder === "all" ? "true" : undefined, onClick: () => select("all"), style: { paddingLeft: TREE_INDENT }, className: cn(subRow, "w-full text-left", dropTarget === "root" && "ring-2 ring-cms-sidebar-ring"), children: t("sidebar.folderAll") }) }) })), folders.filter((f) => !f.parentId).map((folder) => renderFolder(folder, 0)), _jsx("li", { children: _jsxs("button", { type: "button", onClick: () => nav.folderActions.requestCreate(null), style: { paddingLeft: TREE_INDENT }, className: cn(subRow, "w-full text-left text-cms-sidebar-foreground/50"), children: [_jsx(Plus, { "aria-hidden": true, className: "size-3.5" }), t("list.folderAdd")] }) }), folders.length > 0 && (_jsx("li", { children: _jsxs(Label, { className: "gap-2 py-1 font-normal text-cms-sidebar-foreground/60 text-xs", style: { paddingLeft: TREE_INDENT }, children: [_jsx(Switch, { size: "sm", checked: nav.includeDescendants, onCheckedChange: (checked) => nav.onIncludeDescendantsChange(checked === true) }), t("sidebar.includeDescendants")] }) }))] }));
}
/** Left navigation area: Content (collections with their folders, media), Tools (templates, plugin pages, API keys, event log), Trash, and Settings with the theme toggle pinned at the bottom. */
export function AdminSidebar({ activeNav, folderNav, trashCount, eventsCount, folderCounts }) {
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
        if (isMobile)
            setOpenMobile(false);
    };
    const navLink = (href, id, label, icon, badge, trailing) => (_jsxs(SidebarMenuItem, { children: [_jsxs(SidebarMenuButton, { isActive: activeNav === id, tooltip: label, render: _jsx(Link, { href: href, onClick: closeMobile, "aria-current": activeNav === id ? "page" : undefined }), children: [icon, _jsx("span", { className: "flex-1", children: label }), trailing] }), badge] }, id));
    const collectionEntry = (collection) => {
        const active = activeNav === collection;
        const nav = active && folderNav?.collection === collection ? folderNav : undefined;
        const folderCount = nav ? nav.folders.length : (folderCounts?.[collection] ?? 0);
        const chevron = folderCount > 0 ? (active ? (_jsx(ChevronDown, { "aria-hidden": true, className: "size-3! text-cms-sidebar-foreground/60 group-data-[collapsible=icon]:hidden" })) : (_jsx(ChevronRight, { "aria-hidden": true, className: "size-3! text-cms-sidebar-foreground/50 group-data-[collapsible=icon]:hidden" }))) : null;
        return (_jsxs(Fragment, { children: [navLink(site.adminHref(`?collection=${collection}`), collection, site.COLLECTION_DEFINITIONS[collection].label, _jsx(CollectionIcon, { collection: collection }), undefined, chevron), nav && (_jsx(SidebarMenuItem, { children: _jsx(FolderTree, { nav: nav, closeMobile: closeMobile }) }))] }, collection));
    };
    return (_jsxs(Sidebar, { collapsible: "icon", children: [_jsxs(SidebarHeader, { className: "flex-row items-center gap-1 px-3 pt-3.5 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2", children: [_jsxs(Link, { href: site.adminHref(), onClick: closeMobile, className: "flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1 group-data-[collapsible=icon]:hidden", children: [_jsx("span", { "aria-hidden": true, className: "flex size-6 shrink-0 items-center justify-center rounded-md bg-cms-sidebar-primary font-semibold text-cms-sidebar-primary-foreground text-xs", children: (site.SITE_NAME || "CMS").slice(0, 1) }), _jsx("span", { className: "truncate font-semibold text-[13px] text-cms-sidebar-accent-foreground", children: site.SITE_NAME || "CMS" })] }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { render: _jsx(Link, { href: site.SITE_HOME, target: "_blank", rel: "noopener noreferrer", "aria-label": t("sidebar.viewSite"), className: cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "size-8 shrink-0 text-cms-sidebar-foreground/70") }), children: _jsx(ExternalLink, { "aria-hidden": true, className: "size-4" }) }), _jsx(TooltipContent, { side: "right", children: t("sidebar.viewSite") })] }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { render: _jsx(SidebarTrigger, { "aria-label": toggleLabel, className: "size-8 shrink-0 text-cms-sidebar-foreground/70" }) }), _jsx(TooltipContent, { side: "right", children: toggleLabel })] })] }), _jsxs(SidebarContent, { children: [_jsxs(SidebarGroup, { children: [_jsx(SidebarGroupLabel, { children: t("sidebar.content") }), _jsx(SidebarGroupContent, { children: _jsxs(SidebarMenu, { "aria-label": t("sidebar.content"), children: [site.COLLECTIONS.map(collectionEntry), features.media && navLink(site.adminHref("/media"), "media", t("sidebar.media"), _jsx(FileImage, {}))] }) })] }), _jsxs(SidebarGroup, { className: "pt-0", children: [_jsx(SidebarGroupLabel, { children: t("sidebar.tools") }), _jsx(SidebarGroupContent, { children: _jsxs(SidebarMenu, { "aria-label": t("sidebar.tools"), children: [site.ADMIN_TEMPLATES &&
                                            navLink(site.adminHref("/templates"), "templates", t("sidebar.templates"), _jsx(LayoutTemplate, {})), toolsPages(site).map((page) => navLink(page.href, `tools:${page.path}`, page.label, _jsx(NamedIcon, { name: page.icon }))), navLink(site.adminHref("/api-keys"), "api-keys", t("sidebar.apiKeys"), _jsx(KeyRound, {})), navLink(site.adminHref("/events"), "events", t("sidebar.events"), _jsx(Activity, {}), eventsCount ? (_jsx(SidebarMenuBadge, { "aria-label": t("sidebar.eventsBadge", { count: eventsCount }), className: "text-cms-destructive", children: eventsCount })) : null)] }) })] }), _jsx(SidebarSeparator, {}), _jsx(SidebarGroup, { className: "pt-0", children: _jsx(SidebarGroupContent, { children: _jsx(SidebarMenu, { "aria-label": t("sidebar.trash"), children: navLink(site.adminHref("/trash"), "trash", t("sidebar.trash"), _jsx(Trash2, {}), trashCount ? (_jsx(SidebarMenuBadge, { "aria-label": t("sidebar.trashBadge", { count: trashCount }), children: trashCount })) : null) }) }) })] }), _jsxs(SidebarFooter, { className: "flex-row items-center gap-1 border-cms-sidebar-border border-t px-2 py-2 group-data-[collapsible=icon]:flex-col", children: [_jsx(SidebarMenu, { "aria-label": t("sidebar.settings"), className: "min-w-0 flex-1", children: navLink(site.adminHref("/settings"), "settings", t("sidebar.settings"), _jsx(Settings2, {})) }), _jsx(ThemeToggle, { className: "size-8 shrink-0 text-cms-muted-foreground" })] })] }));
}
