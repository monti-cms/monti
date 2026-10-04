import type { Editor } from "@tiptap/core";
import { type ReactNode } from "react";
import type { ToolbarItem } from "./toolbar-button.js";
/** One tool. When narrow, tools with the largest `priority` move into the "More" menu (`menu`) first. */
export interface ToolbarSlot {
    key: string;
    priority: number;
    /** A tool that cannot live inside a menu, like a popover. Never hidden. */
    fixed?: boolean;
    render: () => ReactNode;
    /** How it looks inside the "More" menu. Not needed for pinned tools. */
    menu?: () => ReactNode;
}
export type ToolbarEntry = ToolbarSlot | {
    key: string;
    divider: true;
};
export declare function ToolbarDivider(): import("react").JSX.Element;
/** One tool row in a dropdown or the "More" menu. */
export declare function ToolbarMenuItem({ editor, item }: {
    editor: Editor;
    item: ToolbarItem;
}): import("react").JSX.Element;
/**
 * A group inside the "More" menu. A divider goes above it unless it is first in the menu.
 * No heading is used (the item icon and name make it clear). `label` is the group name (for screen readers).
 */
export declare function ToolbarMenuSection({ label, children }: {
    label: string;
    children: ReactNode;
}): import("react").JSX.Element;
/** A dropdown group expanded inside the "More" menu. */
export declare function ToolbarMenuGroup({ editor, label, items }: {
    editor: Editor;
    label: string;
    items: ToolbarItem[];
}): import("react").JSX.Element;
/**
 * A one-row tool group. When width runs short, lower-priority tools move to the trailing "More" menu.
 * Every tool is rendered once in an invisible row to measure widths, then the tools to show are chosen to fit the real row's available width.
 * Pinned tools such as popovers must not be rendered twice, so their width is measured in the real row.
 */
export declare function ToolbarRow({ editor, entries, end }: {
    editor: Editor;
    entries: ToolbarEntry[];
    end?: ReactNode;
}): import("react").JSX.Element;
