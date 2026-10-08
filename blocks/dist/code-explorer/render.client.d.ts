import { type ReactNode } from "react";
import { type TreeNode } from "./tree.js";
/** Fixed text of the public component. The site language picks it in `render.tsx` (`shared/labels.messages.ts`). */
export interface CodeExplorerLabels {
    /** Accessible name of the file tree. */
    readonly files: string;
    /** Hint of the button that opens and closes the file list on a narrow screen. */
    readonly toggle: string;
}
/**
 * The switching part of the code explorer. Renders the file tree (WAI-ARIA tree: arrow keys, Home, End, Enter and Space, one tab stop) and one panel per file that has
 * code. The server renders and passes the panels (the original code blocks), so here only the shown file is switched (the rest are `hidden`) and folders opened and closed.
 * A `cms:reveal` event from inside a hidden panel (a code link to a line of that file) shows that file first, so the scroll that follows lands on visible lines.
 * On a narrow screen the tree sits above the code behind a button that shows the current path.
 */
export declare function CodeExplorerView({ tree, panels, initial, labels, }: {
    /** The tree built from the paths (`buildTree`). */
    readonly tree: readonly TreeNode[];
    /** Code block of each entry, by `TreeFile.index`. `null` for entries with no panel. */
    readonly panels: readonly ReactNode[];
    /** `index` of the file shown first, or `null` when no file has code (only the tree is shown). */
    readonly initial: number | null;
    readonly labels?: CodeExplorerLabels;
}): import("react").JSX.Element;
