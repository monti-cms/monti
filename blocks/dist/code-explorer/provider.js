"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { CmsAdminComponentsProvider } from "@monti-cms/admin";
import { FolderTree } from "lucide-react";
import { CodeExplorerNodeView } from "./view.js";
const components = {
    blockViews: { "code-explorer": CodeExplorerNodeView },
    icons: { "folder-tree": FolderTree },
};
/** Registers the code explorer block's editing view and menu icon in the admin UI. */
export function CodeExplorerProvider({ children }) {
    return _jsx(CmsAdminComponentsProvider, { components: components, children: children });
}
