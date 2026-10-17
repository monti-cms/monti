"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/site";
import { X } from "lucide-react";
import { commonMessages } from "../../lib/common.messages.js";
import { cn } from "../../lib/utils/cn.js";
import { IconButton } from "../../ui/icon-button.js";
import { PanelResizeHandle, usePanelResize } from "../../ui/panel-resize.js";
/** Width classes of the right slot on wide screens: `--panel-width` comes from `usePanelResize` (written literally so Tailwind can read it). */
export const SIDE_PANEL_WIDTH = "w-[22rem] max-w-full sm:w-[var(--panel-width)]";
/**
 * Place of the right slot opened beside the list (taxonomy edit, media detail). On narrow screens it covers the list,
 * on wide screens it sits beside the list at the width chosen with the drag handle on its left edge.
 */
const SIDE_PANEL_DOCK = "absolute inset-y-0 right-0 z-20 w-full shadow-monti-pop sm:w-[var(--panel-width)] lg:relative lg:shrink-0 lg:shadow-none";
/** The right slot beside a list, with a drag handle on its left edge. The panel inside fills it. */
export function DockedPanel({ resize, children }) {
    const panel = usePanelResize(resize);
    return (_jsxs("div", { className: SIDE_PANEL_DOCK, style: panel.style, children: [_jsx(PanelResizeHandle, { resize: panel }), children] }));
}
/** Widths of the panels beside a list or an editor (px). Each kind remembers its own width. */
export const RECORD_PANEL_RESIZE = { name: "record", defaultWidth: 448, minWidth: 352 };
export const MEDIA_PANEL_RESIZE = { name: "media-detail", defaultWidth: 384, minWidth: 352 };
export const INSPECTOR_PANEL_RESIZE = { name: "inspector", defaultWidth: 384, minWidth: 352 };
/** Background of the item currently open in the list (open in the right slot or edit slot). */
export const OPEN_ITEM = "bg-monti-accent text-monti-accent-foreground";
/** Right slot header. A title and a close button (the name is always "Close"). */
export function SidePanelHeader({ title, onClose, className, children, }) {
    const t = useTranslator(commonMessages);
    return (_jsxs("div", { className: cn("flex h-11 shrink-0 items-center gap-1 border-b pr-2 pl-4", className), children: [title !== undefined && _jsx("h2", { className: "min-w-0 flex-1 truncate font-medium text-sm", children: title }), children, _jsx(IconButton, { label: t("close"), side: "bottom", onClick: onClose, children: _jsx(X, { "aria-hidden": true }) })] }));
}
