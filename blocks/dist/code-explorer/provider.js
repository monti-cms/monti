"use client";
import { FolderTree } from "lucide-react";
import { CodeExplorerNodeView } from "./view.js";
/** The code explorer block's editing view and menu icon. */
export const codeExplorerComponents = {
    blockViews: { "code-explorer": CodeExplorerNodeView },
    icons: { "folder-tree": FolderTree },
};
