import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChevronDown } from "lucide-react";
import { Button } from "../ui/button.js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../ui/dropdown-menu.js";
import { IconButton } from "../ui/icon-button.js";
import { ToolbarMenuItem } from "./toolbar-row.js";
export function ToolbarDropdown({ editor, label, items, icon: Icon, iconOnly = false, }) {
    const content = (_jsxs(_Fragment, { children: [Icon && _jsx(Icon, { "aria-hidden": true, className: "size-4" }), !iconOnly && label, _jsx(ChevronDown, { "aria-hidden": true, className: "size-3" })] }));
    return (_jsxs(DropdownMenu, { children: [iconOnly ? (_jsx(IconButton, { label: label, side: "bottom", size: "sm", className: "h-8 gap-1 px-1.5 text-xs", disabled: !editor.isEditable, onMouseDown: (event) => event.preventDefault(), trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: content })) : (_jsx(DropdownMenuTrigger, { render: _jsx(Button, { type: "button", variant: "ghost", size: "sm", className: "h-8 gap-1 px-2 text-xs", "aria-label": label, disabled: !editor.isEditable, onMouseDown: (event) => event.preventDefault() }), children: content })), _jsx(DropdownMenuContent, { align: "start", className: "min-w-36", children: items.map((item) => (_jsx(ToolbarMenuItem, { editor: editor, item: item }, item.label))) })] }));
}
