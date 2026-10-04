"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createTranslator } from "@monti-cms/core/client";
import { MoreHorizontal } from "lucide-react";
import { cloneElement } from "react";
import { useHydrated } from "../../lib/hooks/use-hydrated.js";
import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger, } from "../../ui/context-menu.js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, } from "../../ui/dropdown-menu.js";
import { IconButton } from "../../ui/icon-button.js";
import { sharedMessages } from "./messages.js";
const t = createTranslator(sharedMessages);
/** Removes leading, trailing or consecutive separators (after dropping conditional items). */
function tidy(actions) {
    const out = [];
    for (const action of actions) {
        if (action.kind === "separator" && (out.length === 0 || out.at(-1)?.kind === "separator"))
            continue;
        out.push(action);
    }
    while (out.at(-1)?.kind === "separator")
        out.pop();
    return out;
}
function ContextItems({ actions }) {
    return tidy(actions).map((action, index) => {
        const key = `${action.kind}-${"label" in action ? action.label : index}-${index}`;
        switch (action.kind) {
            case "separator":
                return _jsx(ContextMenuSeparator, {}, key);
            case "label":
                return (_jsx(ContextMenuGroup, { children: _jsx(ContextMenuLabel, { children: action.label }) }, key));
            case "sub":
                return (_jsxs(ContextMenuSub, { children: [_jsxs(ContextMenuSubTrigger, { disabled: action.disabled, children: [action.icon && _jsx(action.icon, { "aria-hidden": true }), action.label] }), _jsx(ContextMenuSubContent, { className: "max-h-80 overflow-y-auto", children: action.items.length === 0 ? (_jsx(ContextMenuItem, { disabled: true, children: action.emptyLabel ?? t("menu.empty") })) : (_jsx(ContextItems, { actions: action.items })) })] }, key));
            case "item":
                return (_jsxs(ContextMenuItem, { variant: action.destructive ? "destructive" : "default", disabled: action.disabled, onClick: action.onSelect, children: [action.icon && _jsx(action.icon, { "aria-hidden": true }), action.label, action.shortcut && _jsx(ContextMenuShortcut, { children: action.shortcut })] }, key));
            default:
                return null;
        }
    });
}
function DropdownItems({ actions }) {
    return tidy(actions).map((action, index) => {
        const key = `${action.kind}-${"label" in action ? action.label : index}-${index}`;
        switch (action.kind) {
            case "separator":
                return _jsx(DropdownMenuSeparator, {}, key);
            case "label":
                return (_jsx(DropdownMenuGroup, { children: _jsx(DropdownMenuLabel, { children: action.label }) }, key));
            case "sub":
                return (_jsxs(DropdownMenuSub, { children: [_jsxs(DropdownMenuSubTrigger, { disabled: action.disabled, children: [action.icon && _jsx(action.icon, { "aria-hidden": true }), action.label] }), _jsx(DropdownMenuSubContent, { className: "max-h-80 overflow-y-auto", children: action.items.length === 0 ? (_jsx(DropdownMenuItem, { disabled: true, children: action.emptyLabel ?? t("menu.empty") })) : (_jsx(DropdownItems, { actions: action.items })) })] }, key));
            case "item":
                return (_jsxs(DropdownMenuItem, { variant: action.destructive ? "destructive" : "default", disabled: action.disabled, onClick: action.onSelect, children: [action.icon && _jsx(action.icon, { "aria-hidden": true }), action.label, action.shortcut && _jsx(DropdownMenuShortcut, { children: action.shortcut })] }, key));
            default:
                return null;
        }
    });
}
/**
 * Right-clicking `trigger` (or Shift+F10 / the menu key) opens the menu. `trigger` is the element to actually render
 * (e.g. `<TableRow />`). If the menu is empty, right-click is not intercepted.
 */
export function ActionContextMenu({ actions, trigger, children, onOpenChange, }) {
    const items = tidy(actions);
    const hydrated = useHydrated();
    // Rendering Base UI ContextMenu on the server makes the auto ID (useId) of following elements differ between server and browser
    // (hydration mismatch). Right-click works only after hydration, so attach the menu then.
    if (!hydrated)
        return cloneElement(trigger, undefined, children);
    return (_jsxs(ContextMenu, { onOpenChange: onOpenChange, disabled: items.length === 0, children: [_jsx(ContextMenuTrigger, { render: trigger, className: "select-auto", children: children }), _jsx(ContextMenuContent, { className: "min-w-48", children: _jsx(ContextItems, { actions: items }) })] }));
}
/** Always-visible `⋯` button. Opens the same items as the right-click menu. */
export function MoreActionsButton({ actions, label, className, }) {
    const items = tidy(actions);
    if (items.length === 0)
        return null;
    return (_jsxs(DropdownMenu, { children: [_jsx(IconButton, { label: label, className: className, trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: _jsx(MoreHorizontal, { "aria-hidden": true }) }), _jsx(DropdownMenuContent, { align: "end", className: "min-w-48", children: _jsx(DropdownItems, { actions: items }) })] }));
}
