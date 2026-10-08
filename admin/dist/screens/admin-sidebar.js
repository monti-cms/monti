"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { BellRing, ChevronRight, FileImage, Folder as FolderIcon, FolderOpen, FolderPlus, Globe, LayoutTemplate, Plus, Settings2, Trash2, } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../lib/utils/cn.js";
import { AdminLink as Link } from "../router/index.js";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible.js";
import { IconButton } from "../ui/icon-button.js";
import { Label } from "../ui/label.js";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem, SidebarTrigger, useSidebar, } from "../ui/sidebar.js";
import { Switch } from "../ui/switch.js";
import { ThemeToggle } from "../ui/theme-toggle.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip.js";
import { screensMessages } from "./messages.js";
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
/**
 * Tree connector lines. Draws a vertical line and an L-shaped (`ㄴ`) horizontal line on the left of each row, and the last row's vertical line stops at the horizontal line.
 * The horizontal line sits at 14px, half the row height (28px). The vertical line passes through the center of the parent folder icon (or top-level icon).
 */
const TREE_LIST = "mx-0 translate-x-0 gap-0 border-l-0 py-0 pr-0 pl-6";
const TREE_ITEM = "before:-left-3 after:-left-3 before:absolute before:top-0 before:h-full before:w-px before:bg-cms-sidebar-foreground/20 after:absolute after:top-3.5 after:h-px after:w-3.5 after:bg-cms-sidebar-foreground/20 last:before:h-3.5";
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
    const renderFolder = (folder) => {
        const children = folders.filter((f) => f.parentId === folder.id);
        const isExpanded = expandedIds.has(folder.id);
        const isActive = currentFolder === folder.id;
        const actions = folderMenuActions(site, folder, nav.folders, nav.folderActions);
        return (_jsxs(Collapsible, { open: isExpanded, onOpenChange: (open) => setExpandedIds((prev) => {
                const next = new Set(prev);
                if (open)
                    next.add(folder.id);
                else
                    next.delete(folder.id);
                return next;
            }), render: _jsx(SidebarMenuSubItem, { className: TREE_ITEM }), children: [_jsxs(ActionContextMenu, { actions: actions, trigger: _jsx("div", { ...dropProps(folder.id, folder.id), "data-active": isActive || undefined, className: cn("group/folder flex h-7 items-center rounded-md text-cms-sidebar-foreground hover:bg-cms-sidebar-accent hover:text-cms-sidebar-accent-foreground data-active:bg-cms-sidebar-accent data-active:font-medium data-active:text-cms-sidebar-accent-foreground", dropTarget === folder.id && "ring-2 ring-cms-sidebar-ring") }), children: [children.length > 0 ? (_jsxs(CollapsibleTrigger, { "aria-label": t(isExpanded ? "sidebar.folderCollapse" : "sidebar.folderExpand", { name: folder.name }), className: "group/toggle flex size-6 shrink-0 items-center justify-center rounded-md outline-hidden hover:bg-cms-sidebar-foreground/10 focus-visible:ring-2 focus-visible:ring-cms-sidebar-ring [&_svg]:size-4", children: [_jsx("span", { className: "group-hover/toggle:hidden group-focus-visible/toggle:hidden", children: isExpanded ? _jsx(FolderOpen, { "aria-hidden": true }) : _jsx(FolderIcon, { "aria-hidden": true }) }), _jsx(ChevronRight, { "aria-hidden": true, className: cn("hidden transition-transform group-hover/toggle:block group-focus-visible/toggle:block", isExpanded && "rotate-90") })] })) : (_jsx("span", { "aria-hidden": true, className: "flex size-6 shrink-0 items-center justify-center", children: _jsx(FolderIcon, { className: "size-4" }) })), _jsx(SidebarMenuButton, { size: "sm", isActive: isActive, "aria-current": isActive ? "true" : undefined, onClick: () => select(folder.id), onKeyDown: folderKeyHandler(folder, nav.folderActions), className: "min-w-0 flex-1 bg-transparent pl-1 hover:bg-transparent active:bg-transparent data-active:bg-transparent", children: _jsx("span", { children: folder.name }) }), _jsx(MoreActionsButton, { actions: actions, label: t("list.folderActions", { name: folder.name }), className: "size-6 shrink-0 text-cms-sidebar-foreground/70" })] }), children.length > 0 && (_jsx(CollapsibleContent, { children: _jsx(SidebarMenuSub, { className: cn(TREE_LIST, "ml-0"), children: children.map(renderFolder) }) }))] }, folder.id));
    };
    const label = site.COLLECTION_DEFINITIONS[nav.collection].label;
    const blankActions = [
        {
            kind: "item",
            label: t("list.folderAdd"),
            icon: FolderPlus,
            onSelect: () => nav.folderActions.requestCreate(null),
        },
        { kind: "item", label: t("list.add", { label }), icon: Plus, onSelect: nav.onCreateEntry },
    ];
    return (_jsxs(SidebarGroup, { className: "flex-1 group-data-[collapsible=icon]:hidden", children: [_jsx(SidebarGroupLabel, { children: t("sidebar.folders") }), _jsx(IconButton, { label: t("list.folderAdd"), side: "right", size: "icon-xs", className: "absolute top-3.5 right-3 size-5 text-cms-sidebar-foreground hover:bg-cms-sidebar-accent hover:text-cms-sidebar-accent-foreground group-data-[collapsible=icon]:hidden [&_svg]:size-4", onClick: () => nav.folderActions.requestCreate(null), children: _jsx(Plus, { "aria-hidden": true }) }), _jsxs(SidebarGroupContent, { className: "flex flex-1 flex-col", children: [_jsx(SidebarMenu, { children: _jsxs(SidebarMenuItem, { children: [_jsx(ActionContextMenu, { actions: blankActions, trigger: _jsx("div", {}), children: _jsxs(SidebarMenuButton, { size: "sm", ...dropProps("root", null), isActive: currentFolder === "all", "aria-current": currentFolder === "all" ? "true" : undefined, onClick: () => select("all"), className: cn(dropTarget === "root" && "ring-2 ring-cms-sidebar-ring"), children: [_jsx(CollectionIcon, { collection: nav.collection }), _jsx("span", { children: label })] }) }), folders.length > 0 && (_jsx(SidebarMenuSub, { "aria-label": t("sidebar.folderTree", { label }), className: cn(TREE_LIST, "ml-1"), children: folders.filter((f) => !f.parentId).map(renderFolder) }))] }) }), folders.length === 0 && (_jsx("p", { className: "px-2 py-2 text-cms-muted-foreground text-xs", children: t("sidebar.noFolders") })), folders.length > 0 && (_jsxs(Label, { className: "mt-3 px-2 font-normal text-cms-muted-foreground text-xs", children: [_jsx(Switch, { size: "sm", checked: nav.includeDescendants, onCheckedChange: (checked) => nav.onIncludeDescendantsChange(checked === true) }), t("sidebar.includeDescendants")] })), _jsx(ActionContextMenu, { actions: blankActions, trigger: _jsx("div", { "aria-hidden": true, className: "min-h-16 flex-1" }) })] })] }));
}
/** Left navigation area: collections, media/templates/trash, virtual folder tree. */
export function AdminSidebar({ activeNav, folderNav, trashCount, eventsCount }) {
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
        if (isMobile)
            setOpenMobile(false);
    };
    const navLink = (href, id, label, icon, badge) => (_jsxs(SidebarMenuItem, { children: [_jsxs(SidebarMenuButton, { isActive: activeNav === id, tooltip: label, render: _jsx(Link, { href: href, onClick: closeMobile, "aria-current": activeNav === id ? "page" : undefined }), children: [icon, _jsx("span", { children: label })] }), badge] }, id));
    return (_jsxs(Sidebar, { collapsible: "icon", children: [_jsxs(SidebarHeader, { className: "flex-row items-center gap-1 px-3 pt-3.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2", children: [_jsxs(Link, { href: site.adminHref(), onClick: closeMobile, className: "flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1 group-data-[collapsible=icon]:hidden", children: [_jsx("span", { "aria-hidden": true, className: "flex size-6 items-center justify-center rounded-md bg-cms-sidebar-primary font-semibold text-cms-sidebar-primary-foreground text-xs", children: (site.SITE_NAME || "CMS").slice(0, 1) }), _jsx("span", { className: "font-semibold text-[13px] text-cms-sidebar-accent-foreground", children: site.SITE_NAME || "CMS" })] }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { render: _jsx(SidebarTrigger, { "aria-label": toggleLabel, className: "size-8 shrink-0 text-cms-sidebar-foreground/70" }) }), _jsx(TooltipContent, { side: "right", children: toggleLabel })] })] }), _jsxs(SidebarContent, { children: [_jsxs(SidebarGroup, { children: [_jsx(SidebarGroupLabel, { children: t("sidebar.collections") }), _jsx(SidebarGroupContent, { children: _jsx(SidebarMenu, { "aria-label": t("sidebar.collections"), children: site.COLLECTIONS.map((collection) => navLink(site.adminHref(`?collection=${collection}`), collection, site.COLLECTION_DEFINITIONS[collection].label, _jsx(CollectionIcon, { collection: collection }))) }) })] }), _jsxs(SidebarGroup, { children: [_jsx(SidebarGroupLabel, { children: t("sidebar.manage") }), _jsx(SidebarGroupContent, { children: _jsxs(SidebarMenu, { "aria-label": t("sidebar.manage"), children: [features.media && navLink(site.adminHref("/media"), "media", t("sidebar.media"), _jsx(FileImage, {})), site.ADMIN_TEMPLATES &&
                                            navLink(site.adminHref("/templates"), "templates", t("sidebar.templates"), _jsx(LayoutTemplate, {})), navLink(site.adminHref("/schema"), "schema", t("sidebar.schema"), _jsx(Settings2, {})), pluginNav.map((item) => navLink(site.adminHref(`/${item.path}`), item.path, item.label, _jsx(NamedIcon, { name: item.icon }))), navLink(site.adminHref("/events"), "events", t("sidebar.events"), _jsx(BellRing, {}), eventsCount ? (_jsx(SidebarMenuBadge, { "aria-label": t("sidebar.eventsBadge", { count: eventsCount }), children: eventsCount })) : null), navLink(site.adminHref("/trash"), "trash", t("sidebar.trash"), _jsx(Trash2, {}), trashCount ? (_jsx(SidebarMenuBadge, { "aria-label": t("sidebar.trashBadge", { count: trashCount }), children: trashCount })) : null)] }) })] }), folderNav && _jsx(FolderTree, { nav: folderNav, closeMobile: closeMobile })] }), _jsxs(SidebarFooter, { className: "flex-row items-center gap-1 border-cms-sidebar-border border-t px-3 py-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-2", children: [_jsxs(Tooltip, { children: [_jsxs(TooltipTrigger, { render: _jsx(Link, { href: site.SITE_HOME, "aria-label": t("sidebar.viewSite"), className: "flex h-8 flex-1 items-center gap-2 rounded-md px-2 text-[13px] text-cms-muted-foreground hover:bg-cms-sidebar-accent hover:text-cms-sidebar-accent-foreground group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0" }), children: [_jsx(Globe, { "aria-hidden": true, className: "size-4" }), _jsx("span", { className: "group-data-[collapsible=icon]:hidden", children: t("sidebar.viewSite") })] }), _jsx(TooltipContent, { side: "right", hidden: state !== "collapsed" || isMobile, children: t("sidebar.viewSite") })] }), _jsx(ThemeToggle, { className: "size-8 text-cms-muted-foreground" })] })] }));
}
