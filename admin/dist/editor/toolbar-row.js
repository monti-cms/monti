"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createTranslator } from "@monti-cms/core/client";
import { Check, MoreHorizontal } from "lucide-react";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "../ui/dropdown-menu.js";
import { IconButton } from "../ui/icon-button.js";
import { editorMessages } from "./messages.js";
import { fitSlots, layoutKeys } from "./toolbar-fit.js";
const t = createTranslator(editorMessages);
const isDivider = (entry) => "divider" in entry;
/** Gap between toolbar items (gap-1) and the width of the "More" button (size-8). */
const GAP = 4;
const OVERFLOW_WIDTH = 32;
const END_KEY = "end";
export function ToolbarDivider() {
    return _jsx("span", { "aria-hidden": true, className: "mx-1 h-5 w-px shrink-0 self-center bg-cms-border" });
}
/** One tool row in a dropdown or the "More" menu. */
export function ToolbarMenuItem({ editor, item }) {
    const active = item.isActive?.(editor) ?? false;
    return (_jsxs(DropdownMenuItem, { disabled: !editor.isEditable || (item.isDisabled?.(editor) ?? false), onClick: () => item.run(editor), children: [_jsx(item.icon, { "aria-hidden": true, className: "size-4" }), _jsx("span", { className: "flex-1", children: item.title ?? item.label }), active && _jsx(Check, { "aria-hidden": true, className: "size-4" })] }));
}
/**
 * A group inside the "More" menu. A divider goes above it unless it is first in the menu.
 * No heading is used (the item icon and name make it clear). `label` is the group name (for screen readers).
 */
export function ToolbarMenuSection({ label, children }) {
    return (_jsxs(_Fragment, { children: [_jsx(DropdownMenuSeparator, { className: "first:hidden" }), _jsx(DropdownMenuGroup, { "aria-label": label, children: children })] }));
}
/** A dropdown group expanded inside the "More" menu. */
export function ToolbarMenuGroup({ editor, label, items }) {
    return (_jsx(ToolbarMenuSection, { label: label, children: items.map((item) => (_jsx(ToolbarMenuItem, { editor: editor, item: item }, item.label))) }));
}
function OverflowMenu({ editor, children }) {
    return (_jsxs(DropdownMenu, { children: [_jsx(IconButton, { label: t("toolbarRow.more"), side: "bottom", className: "shrink-0", disabled: !editor.isEditable, onMouseDown: (event) => event.preventDefault(), trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: _jsx(MoreHorizontal, { className: "size-4", "aria-hidden": true }) }), _jsx(DropdownMenuContent, { align: "end", className: "min-w-44", children: children })] }));
}
const sameKeys = (a, b) => a.length === b.length && a.every((key, i) => key === b[i]);
/**
 * A one-row tool group. When width runs short, lower-priority tools move to the trailing "More" menu.
 * Every tool is rendered once in an invisible row to measure widths, then the tools to show are chosen to fit the real row's available width.
 * Pinned tools such as popovers must not be rendered twice, so their width is measured in the real row.
 */
export function ToolbarRow({ editor, entries, end }) {
    const areaRef = useRef(null);
    const measureRef = useRef(null);
    const rowRef = useRef(null);
    const [hidden, setHidden] = useState([]);
    const hasEnd = !!end;
    const recompute = useCallback(() => {
        const area = areaRef.current;
        if (!area)
            return;
        // With no layout (before the first paint, jsdom) everything is shown.
        const available = area.clientWidth;
        if (!available)
            return;
        const widths = new Map();
        const read = (root, attr) => {
            for (const element of root?.querySelectorAll(`[${attr}]`) ?? []) {
                widths.set(element.getAttribute(attr) ?? "", Math.ceil(element.getBoundingClientRect().width));
            }
        };
        read(measureRef.current, "data-measure-key");
        read(rowRef.current, "data-slot-key");
        const items = entries.map((entry) => isDivider(entry)
            ? { key: entry.key, priority: 0, width: widths.get(entry.key) ?? 0, divider: true }
            : { key: entry.key, priority: entry.priority, fixed: entry.fixed, width: widths.get(entry.key) ?? 0 });
        if (hasEnd)
            items.push({ key: END_KEY, priority: 0, fixed: true, width: widths.get(END_KEY) ?? 0 });
        const visible = fitSlots(items, available, OVERFLOW_WIDTH, GAP);
        const next = entries.filter((entry) => !isDivider(entry) && !visible.has(entry.key)).map((entry) => entry.key);
        setHidden((previous) => (sameKeys(previous, next) ? previous : next));
    }, [entries, hasEnd]);
    const recomputeRef = useRef(recompute);
    recomputeRef.current = recompute;
    // Re-measure on every render. If the visible tools stay the same, state is not changed, so there is no re-render.
    useLayoutEffect(() => {
        recompute();
    });
    useEffect(() => {
        if (typeof ResizeObserver === "undefined")
            return;
        const observer = new ResizeObserver(() => recomputeRef.current());
        if (areaRef.current)
            observer.observe(areaRef.current);
        if (measureRef.current)
            observer.observe(measureRef.current);
        return () => observer.disconnect();
    }, []);
    const hiddenSet = new Set(hidden);
    const slots = entries.filter((entry) => !isDivider(entry));
    const visible = new Set(slots.filter((slot) => !hiddenSet.has(slot.key)).map((slot) => slot.key));
    const shown = new Set(layoutKeys(entries.map((entry) => ({ key: entry.key, priority: 0, width: 0, divider: isDivider(entry) })), visible));
    const hiddenSlots = slots.filter((slot) => hiddenSet.has(slot.key));
    return (_jsxs("div", { ref: areaRef, className: "relative min-w-0 flex-1", children: [_jsx("div", { "aria-hidden": true, inert: true, className: "pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden", children: _jsx("div", { ref: measureRef, className: "flex w-max items-center gap-1", children: entries.map((entry) => isDivider(entry) ? (_jsx("div", { "data-measure-key": entry.key, className: "flex shrink-0 items-center", children: _jsx(ToolbarDivider, {}) }, entry.key)) : entry.fixed ? null : (_jsx("div", { "data-measure-key": entry.key, className: "flex shrink-0 items-center", children: entry.render() }, entry.key))) }) }), _jsxs("div", { ref: rowRef, className: "flex flex-nowrap items-center justify-center gap-1", children: [entries.map((entry) => {
                        if (!shown.has(entry.key))
                            return null;
                        if (isDivider(entry))
                            return _jsx(ToolbarDivider, {}, entry.key);
                        return (_jsx("div", { "data-slot-key": entry.fixed ? entry.key : undefined, className: "flex shrink-0 items-center", children: entry.render() }, entry.key));
                    }), hiddenSlots.length > 0 && (_jsx(OverflowMenu, { editor: editor, children: hiddenSlots.map((slot) => (_jsx(Fragment, { children: slot.menu?.() }, slot.key))) })), end && (_jsx("div", { "data-slot-key": END_KEY, className: "flex shrink-0 items-center", children: end }))] })] }));
}
