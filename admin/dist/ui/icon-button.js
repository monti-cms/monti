"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../lib/utils/index.js";
import { Button } from "./button.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip.js";
/**
 * An icon-only button. `label` is both the screen reader name and the tooltip shown on hover (the two are always the same).
 * With `pressed` it becomes a toggle button and has a background while on.
 * For a button that opens a menu or popover, wrap it with `trigger`: `trigger={(button) => <PopoverTrigger render={button} />}`.
 */
export function IconButton({ label, pressed, destructive, side = "top", size = "icon-sm", variant = "ghost", className, trigger, children, ...props }) {
    const button = (_jsx(Button, { type: "button", variant: variant, size: size, "aria-label": label, "aria-pressed": pressed, className: cn("aria-pressed:bg-cms-accent aria-pressed:text-cms-accent-foreground", destructive && "text-cms-destructive hover:bg-cms-destructive/10 hover:text-cms-destructive", className), ...props }));
    return (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { render: trigger ? trigger(button) : button, children: children }), _jsx(TooltipContent, { side: side, children: label })] }));
}
