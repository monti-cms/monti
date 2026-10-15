"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../../lib/utils/cn.js";
import { Button } from "../../ui/button.js";
import { Skeleton } from "../../ui/skeleton.js";
import { ActionContextMenu, MoreActionsButton } from "./action-menu.js";
import { LIST_PANE_WIDTH } from "./layout.js";
import { OPEN_ITEM } from "./side-panel.js";
/**
 * A list on the left and the open item's editor (or an empty state) on the right: the shape of the templates page and the AI tabs.
 * `list` is a {@link ListPane}; `children` is the right side, which scrolls on its own.
 */
export function MasterDetail({ list, children }) {
    return (_jsxs("div", { className: "flex min-h-0 flex-1 overflow-hidden", children: [list, _jsx("div", { className: "flex min-w-0 flex-1 flex-col overflow-y-auto", children: children })] }));
}
/**
 * The list column. While `loading` it shows `skeletonRows` placeholders; with no rows it shows `empty`. A `header` (a notice, a toolbar) sits above the rows.
 */
export function ListPane({ label, loading = false, skeletonRows = 3, empty, header, className, children, }) {
    const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
    return (_jsxs("div", { className: cn("flex shrink-0 flex-col border-r", LIST_PANE_WIDTH, className), children: [header, _jsx("ul", { className: cn("min-h-0 flex-1 divide-y overflow-y-auto", !hasRows && !loading && "flex flex-col"), "aria-label": label, children: loading
                    ? Array.from({ length: skeletonRows }, (_, index) => (_jsx("li", { className: "p-3", "aria-hidden": true, children: _jsx(Skeleton, { className: "h-9 w-full" }) }, index)))
                    : hasRows
                        ? children
                        : empty && _jsx("li", { className: "flex flex-1 items-center justify-center p-4 text-center", children: empty }) })] }));
}
/**
 * One row of a {@link ListPane}: the title with a status to its right, and a dim line under it. With `actions` the row also opens a context
 * menu and shows a `⋯` button; `onDelete` is called on the Delete key.
 */
export function ListRow({ title, status, detail, current, onClick, actions, actionsLabel, onDelete, trailing, }) {
    const button = (_jsxs(Button, { variant: "ghost", type: "button", "aria-current": current ? "true" : undefined, onClick: onClick, onKeyDown: (event) => {
            if (onDelete && event.key === "Delete") {
                event.preventDefault();
                onDelete();
            }
        }, className: "h-auto min-w-0 flex-1 flex-col items-start gap-0.5 px-1 py-1 text-left font-normal hover:bg-transparent", children: [_jsxs("span", { className: "flex w-full items-center gap-2", children: [_jsx("span", { className: "truncate font-medium text-sm", children: title }), status && _jsx("span", { className: "ml-auto shrink-0 text-cms-muted-foreground text-xs", children: status })] }), detail && _jsx("span", { className: "w-full truncate text-cms-muted-foreground text-xs", children: detail })] }));
    const rowClass = cn("group flex items-center justify-between gap-2 px-2 py-1.5 transition-colors", current ? OPEN_ITEM : "hover:bg-cms-accent/50");
    if (!actions || actions.length === 0) {
        return (_jsxs("li", { className: rowClass, children: [button, trailing] }));
    }
    return (_jsxs(ActionContextMenu, { actions: actions, trigger: _jsx("li", { className: rowClass }), children: [button, trailing, _jsx(MoreActionsButton, { actions: actions, label: actionsLabel ?? title })] }));
}
