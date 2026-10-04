"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { CmsAdminComponentsProvider } from "@monti-cms/admin";
import { SquareStack } from "lucide-react";
import { TabNodeView, TabsNodeView } from "./view.js";
const components = {
    blockViews: { tabs: TabsNodeView, tab: TabNodeView },
    icons: { "square-stack": SquareStack },
};
/** Registers the tabs block's editing view and menu icon in the admin UI. */
export function TabsProvider({ children }) {
    return _jsx(CmsAdminComponentsProvider, { components: components, children: children });
}
