"use client";

import { FolderTree } from "@carbon/icons-react";
import type { AdminComponents } from "@monti-cms/admin";
import { CodeExplorerNodeView } from "./view";

/** The code explorer block's editing view and menu icon. */
export const codeExplorerComponents: AdminComponents = {
	blockViews: { "code-explorer": CodeExplorerNodeView },
	icons: { "folder--tree": FolderTree },
};
