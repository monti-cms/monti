"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { X } from "lucide-react";
import { cn } from "../../lib/utils/cn.js";
import { IconButton } from "../../ui/icon-button.js";
import { sharedMessages } from "./messages.js";
/** Width of the right slot (taxonomy edit, media detail, post properties). All right slots share the same width. */
export const SIDE_PANEL_WIDTH = "w-[22rem]";
/**
 * Place of the right slot opened beside the list (taxonomy edit, media detail). On narrow screens it covers the list,
 * on wide screens it sits beside the list at the same width as `SIDE_PANEL_WIDTH` (written literally so Tailwind can read it).
 */
export const SIDE_PANEL_DOCK = "absolute inset-y-0 right-0 z-20 w-full shadow-lg sm:w-[22rem] lg:static lg:shrink-0 lg:shadow-none";
/** Background of the item currently open in the list (open in the right slot or edit slot). */
export const OPEN_ITEM = "bg-cms-accent text-cms-accent-foreground";
/** Right slot header. A title and a close button (the name is always "Close"). */
export function SidePanelHeader({ title, onClose, className, children, }) {
    const t = useTranslator(sharedMessages);
    return (_jsxs("div", { className: cn("flex h-11 shrink-0 items-center gap-1 border-b pr-2 pl-4", className), children: [title !== undefined && _jsx("h2", { className: "min-w-0 flex-1 truncate font-medium text-sm", children: title }), children, _jsx(IconButton, { label: t("panel.close"), side: "bottom", onClick: onClose, children: _jsx(X, { "aria-hidden": true }) })] }));
}
