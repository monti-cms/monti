"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createTranslator } from "@monti-cms/core/client";
import { ArrowDown, ArrowUp, Copy, GripVertical, Trash2 } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger, } from "../ui/dropdown-menu.js";
import { IconButton } from "../ui/icon-button.js";
import { Spinner } from "../ui/spinner.js";
import { editorMessages } from "./messages.js";
const t = createTranslator(editorMessages);
/** The ⋮⋮ handle on the left of a block and the block menu. The menu is a shadcn DropdownMenu (Base UI render prop) so it is keyboard operable too, and dragging the handle moves the block. */
export function BlockHandleOverlay({ coords, onMoveUp, onMoveDown, onDuplicate, onDelete, onDragStart, onDragEnd, actions = [], }) {
    const [open, setOpen] = useState(false);
    if (typeof window === "undefined")
        return null;
    return createPortal(_jsxs("div", { style: {
            position: "fixed",
            top: `${coords.top}px`,
            // If there are action buttons, shift left that much more to keep room for the handle.
            left: `${Math.max(8, coords.left - 32 - actions.length * 24)}px`,
            zIndex: 40,
        }, className: "flex items-center", children: [actions.map((action) => (_jsx(IconButton, { label: action.label, side: "bottom", size: "icon-xs", disabled: action.busy, onClick: action.onClick, className: "text-cms-muted-foreground hover:text-cms-foreground", children: action.busy ? _jsx(Spinner, { className: "size-3" }) : action.icon }, action.id))), _jsxs(DropdownMenu, { open: open, onOpenChange: setOpen, modal: false, children: [_jsx(IconButton, { label: t("blockHandle.label"), side: "bottom", size: "icon-xs", draggable: true, onDragStart: (event) => {
                            // A menu opened on press closes when dragging starts.
                            setOpen(false);
                            onDragStart?.(event);
                        }, onDragEnd: onDragEnd, className: "cursor-grab text-cms-muted-foreground active:cursor-grabbing", trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: _jsx(GripVertical, { "aria-hidden": true }) }), _jsxs(DropdownMenuContent, { align: "start", side: "right", className: "w-56", children: [_jsxs(DropdownMenuItem, { onClick: onMoveUp, children: [_jsx(ArrowUp, { "aria-hidden": true }), t("blockHandle.moveUp"), _jsx(DropdownMenuShortcut, { children: "\u2325\u2191" })] }), _jsxs(DropdownMenuItem, { onClick: onMoveDown, children: [_jsx(ArrowDown, { "aria-hidden": true }), t("blockHandle.moveDown"), _jsx(DropdownMenuShortcut, { children: "\u2325\u2193" })] }), _jsxs(DropdownMenuItem, { onClick: onDuplicate, children: [_jsx(Copy, { "aria-hidden": true }), t("blockHandle.duplicate"), _jsx(DropdownMenuShortcut, { children: "\u21E7\u2318D" })] }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { variant: "destructive", onClick: onDelete, children: [_jsx(Trash2, { "aria-hidden": true }), t("blockHandle.delete"), _jsx(DropdownMenuShortcut, { children: "\u21E7\u2318\u232B" })] })] })] })] }), document.body);
}
