"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils/cn.js";
import { AdminLink as Link } from "../../router/index.js";
import { SidebarTrigger } from "../../ui/sidebar.js";
import { SchemaSettings } from "../schema/schema-screen.js";
import { ShellPage } from "../shared/admin-shell.js";
import { sharedMessages } from "../shared/messages.js";
import { settingsMessages } from "./messages.js";
import { useSettingsTab } from "./place.js";
import { settingsTabs } from "./tabs.js";
/**
 * The Settings page: its own header (title, one line about where it is saved, the pending changes and the review button) over a row of tabs, each its own address
 * (`<admin path>/settings/<tab>`). The tabs are the schema file editor's: site, languages, collections and admin. They share one draft.
 */
export function SettingsScreen({ tab }) {
    const t = useTranslator(settingsMessages);
    return (_jsx(ShellPage, { title: t("title"), nav: "settings", bare: true, children: _jsx(SettingsBody, { tab: tab }) }));
}
function SettingsBody({ tab: renderedTab }) {
    // Moving between tabs changes the address in place: the page, and the draft in it, stay.
    const { tab, go } = useSettingsTab(renderedTab);
    const site = useSite();
    const t = useTranslator(settingsMessages);
    const shared = useTranslator(sharedMessages);
    const tabs = settingsTabs(site);
    // The editor puts its pending-changes line and review button here.
    const [actions, setActions] = useState(null);
    // ... and the line that names the schema file and its version.
    const [fileLine, setFileLine] = useState(null);
    // On a narrow screen the tab bar scrolls sideways: keep the open tab in view.
    const activeLink = useRef(null);
    // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the open tab changes
    useEffect(() => {
        activeLink.current?.scrollIntoView?.({ inline: "center", block: "nearest" });
    }, [tab]);
    return (_jsxs(_Fragment, { children: [_jsxs("header", { className: "shrink-0 border-b bg-cms-background px-4 pt-5 lg:px-10 lg:pt-6", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-x-6 gap-y-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2.5", children: [_jsx(SidebarTrigger, { "aria-label": shared("shell.openSidebar"), className: "-ml-1 text-cms-muted-foreground md:hidden" }), _jsx("h1", { className: "font-semibold text-[22px] leading-tight tracking-tight", children: t("title") }), _jsx("div", { ref: setFileLine, className: "flex items-center gap-1.5 empty:hidden", "data-testid": "settings-file-line" })] }), _jsx("p", { className: "mt-1 text-cms-muted-foreground text-sm", children: t("description") })] }), _jsx("div", { ref: setActions, className: "flex items-center gap-2.5", "data-testid": "settings-actions" })] }), _jsx("nav", { "aria-label": t("tabs.label"), "data-unsaved-guard": "off", className: "mt-4 -mb-px flex items-stretch gap-6 overflow-x-auto", children: tabs.map((entry) => {
                            const active = entry.id === tab;
                            return (_jsx(Link, { onClick: (event) => {
                                    // A click that opens a new tab or window goes the way of a link.
                                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                                        return;
                                    event.preventDefault();
                                    go(entry.id);
                                }, ref: active ? activeLink : undefined, href: entry.href, "aria-current": active ? "page" : undefined, className: cn("flex shrink-0 items-center whitespace-nowrap border-transparent border-b-2 py-2.5 text-cms-muted-foreground text-sm outline-hidden transition-colors hover:text-cms-foreground focus-visible:ring-2 focus-visible:ring-cms-ring/50 aria-[current=page]:border-cms-foreground aria-[current=page]:font-semibold aria-[current=page]:text-cms-foreground"), children: t(`tab.${entry.id}`) }, entry.id));
                        }) })] }), _jsx("div", { className: "flex min-h-0 flex-1 flex-col bg-cms-muted/50", children: _jsx(SchemaSettings, { tab: tab, actionsSlot: actions, fileSlot: fileLine, onTab: go }) })] }));
}
