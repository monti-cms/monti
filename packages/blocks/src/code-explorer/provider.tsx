"use client";

import type { AdminComponents } from "@monti-cms/admin";
import { CodeExplorerNodeView } from "./view";

/** The code explorer block's editing view. */
export const codeExplorerComponents: AdminComponents = {
	blockViews: { "code-explorer": CodeExplorerNodeView },
};
