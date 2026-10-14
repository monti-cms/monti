import type { ReactNode } from "react";
import { type Tree } from "./layout-model.js";
export declare const groupId: (tab: number, block: number) => string;
export declare const emptyId: (tab: number, block: number) => string;
export declare const tabId: (tab: number) => string;
export declare const endId: (tab: number) => string;
/** Rows that can be dragged within one list (the fields of one option): a drop reports which id went onto which. */
export declare function SortableList({ items, onDragEnd, children, }: {
    items: string[];
    onDragEnd: (from: string, to: string) => void;
    children: ReactNode;
}): import("react").JSX.Element;
/** The drag-and-drop context of the layout: every row of `ids` can be dropped on, and a drop writes the tree back through `change`. */
export declare function LayoutDnd({ ids, change, children, }: {
    ids: string[];
    change: (next: (tree: Tree) => Tree) => void;
    children: ReactNode;
}): import("react").JSX.Element;
