"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/site";
import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils/cn.js";
import { AdminLink as Link } from "../../router/index.js";
import { settingsMessages } from "./messages.js";
import { settingsTabs } from "./tabs.js";
const linkClass = "flex shrink-0 items-center whitespace-nowrap border-transparent border-b-2 py-2.5 text-monti-muted-foreground text-sm outline-hidden transition-colors hover:text-monti-foreground focus-visible:ring-2 focus-visible:ring-monti-ring/50 aria-[current=page]:border-monti-foreground aria-[current=page]:font-semibold aria-[current=page]:text-monti-foreground";
/** The row of tabs under the Settings header. A tab changes the address in place when `onSchemaTab` is given, so the schema screen keeps its draft. */
export function SettingsTabBar({ site, active, onSchemaTab, }) {
    const t = useTranslator(settingsMessages);
    const tabs = settingsTabs(site);
    // On a narrow screen the tab bar scrolls sideways: keep the open tab in view.
    const activeLink = useRef(null);
    // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the open tab changes
    useEffect(() => {
        activeLink.current?.scrollIntoView?.({ inline: "center", block: "nearest" });
    }, [active]);
    return (_jsx("nav", { "aria-label": t("tabs.label"), className: "mt-4 -mb-px flex items-stretch gap-6 overflow-x-auto", children: tabs.map((entry) => {
            const isActive = entry.id === active;
            return (_jsx(Link, { "data-unsaved-guard": onSchemaTab ? "off" : undefined, onClick: (event) => {
                    if (!onSchemaTab)
                        return;
                    // A click that opens a new tab or window goes the way of a link.
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                        return;
                    event.preventDefault();
                    onSchemaTab(entry.id);
                }, ref: isActive ? activeLink : undefined, href: entry.href, "aria-current": isActive ? "page" : undefined, className: cn(linkClass), children: t(`tab.${entry.id}`) }, entry.id));
        }) }));
}
