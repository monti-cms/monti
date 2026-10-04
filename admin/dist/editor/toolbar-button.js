"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../lib/utils/cn.js";
import { Button } from "../ui/button.js";
import { Toggle } from "../ui/toggle.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip.js";
/** Icon button for formatting tools and table tools. Does not steal the editor selection when pressed. */
export function ToolbarButton({ editor, item, tooltipSide = "bottom", }) {
    const active = item.isActive?.(editor) ?? false;
    const disabled = !editor.isEditable || (item.isDisabled?.(editor) ?? false);
    const label = item.title ?? item.label;
    const Icon = item.icon;
    const common = {
        "aria-label": label,
        disabled,
        // Keep the button click from stealing the editor selection.
        onMouseDown: (event) => event.preventDefault(),
        className: cn("size-8 p-0 text-xs", item.className),
    };
    return (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { render: item.isActive ? (_jsx(Toggle, { size: "sm", pressed: active, onPressedChange: () => item.run(editor), ...common })) : (_jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => item.run(editor), ...common })), children: _jsx(Icon, { className: "size-4", "aria-hidden": true }) }), _jsx(TooltipContent, { side: tooltipSide, children: label })] }));
}
