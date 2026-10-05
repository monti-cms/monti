"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import { FolderTree } from "lucide-react";
import type { ReactNode } from "react";
import { CodeExplorerNodeView } from "./view";

const components: CmsAdminComponents = {
	blockViews: { "code-explorer": CodeExplorerNodeView },
	icons: { "folder-tree": FolderTree },
};

/** Registers the code explorer block's editing view and menu icon in the admin UI. */
export function CodeExplorerProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
