import type { ReactNode } from "react";
import { type MenuAction } from "./action-menu.js";
/**
 * A list on the left and the open item's editor (or an empty state) on the right: the shape of the templates page and the AI tabs.
 * `list` is a {@link ListPane}; `children` is the right side, which scrolls on its own.
 */
export declare function MasterDetail({ list, children }: {
    list: ReactNode;
    children: ReactNode;
}): import("react").JSX.Element;
/**
 * The list column. While `loading` it shows `skeletonRows` placeholders; with no rows it shows `empty`. A `header` (a notice, a toolbar) sits above the rows.
 */
export declare function ListPane({ label, loading, skeletonRows, empty, header, children, }: {
    label: string;
    loading?: boolean;
    skeletonRows?: number;
    /** Shown in place of the rows when `children` is empty (pass `null` while an error is showing instead). */
    empty?: ReactNode;
    header?: ReactNode;
    children?: ReactNode;
}): import("react").JSX.Element;
/**
 * One row of a {@link ListPane}: the title with a status to its right, and a dim line under it. With `actions` the row also opens a context
 * menu and shows a `⋯` button; `onDelete` is called on the Delete key.
 */
export declare function ListRow({ title, status, detail, current, onClick, actions, actionsLabel, onDelete, }: {
    title: string;
    status?: string | null;
    detail?: ReactNode;
    current: boolean;
    onClick: () => void;
    actions?: MenuAction[];
    /** Name of the `⋯` button; required with `actions`. */
    actionsLabel?: string;
    onDelete?: () => void;
}): import("react").JSX.Element;
