"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useSite } from "@monti-cms/core/client";
import { toolsPages } from "../settings/tabs.js";
import { AdminShell } from "../shared/admin-shell.js";
/** The frame of a plugin page (`<admin path>/tools/<path>`): sidebar and the `nav` label as the title. `children` is the plugin's page, rendered by the server. */
export function ToolsScreen({ path, children }) {
    const site = useSite();
    const label = toolsPages(site).find((page) => page.path === path)?.label ?? path;
    return (_jsx(AdminShell, { title: label, sidebar: { activeNav: `tools:${path}` }, children: children }));
}
