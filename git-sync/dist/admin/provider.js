"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { CmsAdminComponentsProvider } from "@monti-cms/admin";
import { GitBranch } from "lucide-react";
const components = {
    // The icon of the sidebar item (`nav`), picked by name.
    icons: { "git-branch": GitBranch },
};
/** What the git-sync plugin adds to the whole admin screen: the icon of its sidebar item. */
export function GitSyncAdminProvider({ children }) {
    return _jsx(CmsAdminComponentsProvider, { components: components, children: children });
}
