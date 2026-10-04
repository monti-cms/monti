"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { CmsAdminComponentsProvider } from "@monti-cms/admin";
import { ChevronsUpDown } from "lucide-react";
import { CollapsibleNodeView } from "./view.js";
const components = {
    blockViews: { collapsible: CollapsibleNodeView },
    icons: { "chevrons-up-down": ChevronsUpDown },
};
/** Registers the collapsible block's editing view and menu icon in the admin UI. */
export function CollapsibleProvider({ children }) {
    return _jsx(CmsAdminComponentsProvider, { components: components, children: children });
}
