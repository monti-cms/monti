"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "../lib/utils/index.js";
function ContextMenu({ ...props }) {
    return _jsx(ContextMenuPrimitive.Root, { "data-slot": "context-menu", ...props });
}
function ContextMenuPortal({ ...props }) {
    return _jsx(ContextMenuPrimitive.Portal, { "data-slot": "context-menu-portal", ...props });
}
function ContextMenuTrigger({ className, ...props }) {
    return (_jsx(ContextMenuPrimitive.Trigger, { "data-slot": "context-menu-trigger", className: cn("select-none", className), ...props }));
}
function ContextMenuContent({ className, align = "start", alignOffset = 4, side = "right", sideOffset = 0, ...props }) {
    return (_jsx(ContextMenuPrimitive.Portal, { children: _jsx(ContextMenuPrimitive.Positioner, { className: "isolate z-50 outline-none", align: align, alignOffset: alignOffset, side: side, sideOffset: sideOffset, children: _jsx(ContextMenuPrimitive.Popup, { "data-slot": "context-menu-content", className: cn("data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 z-50 max-h-(--available-height) min-w-36 origin-(--transform-origin) overflow-y-auto overflow-x-hidden rounded-md bg-cms-popover p-1 text-cms-popover-foreground shadow-md outline-none ring-1 ring-cms-foreground/10 duration-100 data-closed:animate-out data-open:animate-in", className), ...props }) }) }));
}
function ContextMenuGroup({ ...props }) {
    return _jsx(ContextMenuPrimitive.Group, { "data-slot": "context-menu-group", ...props });
}
function ContextMenuLabel({ className, inset, ...props }) {
    return (_jsx(ContextMenuPrimitive.GroupLabel, { "data-slot": "context-menu-label", "data-inset": inset, className: cn("px-2 py-1.5 font-medium text-cms-muted-foreground text-xs data-inset:pl-8", className), ...props }));
}
function ContextMenuItem({ className, inset, variant = "default", ...props }) {
    return (_jsx(ContextMenuPrimitive.Item, { "data-slot": "context-menu-item", "data-inset": inset, "data-variant": variant, className: cn("group/context-menu-item relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-cms-accent focus:text-cms-accent-foreground data-disabled:pointer-events-none data-inset:pl-8 data-[variant=destructive]:text-cms-destructive data-disabled:opacity-50 cms-dark:data-[variant=destructive]:focus:bg-cms-destructive/20 data-[variant=destructive]:focus:bg-cms-destructive/10 data-[variant=destructive]:focus:text-cms-destructive [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 focus:*:[svg]:text-cms-accent-foreground data-[variant=destructive]:*:[svg]:text-cms-destructive", className), ...props }));
}
function ContextMenuSub({ ...props }) {
    return _jsx(ContextMenuPrimitive.SubmenuRoot, { "data-slot": "context-menu-sub", ...props });
}
function ContextMenuSubTrigger({ className, inset, children, ...props }) {
    return (_jsxs(ContextMenuPrimitive.SubmenuTrigger, { "data-slot": "context-menu-sub-trigger", "data-inset": inset, className: cn("flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-cms-accent focus:text-cms-accent-foreground data-open:bg-cms-accent data-inset:pl-8 data-open:text-cms-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0", className), ...props, children: [children, _jsx(ChevronRightIcon, { className: "ml-auto" })] }));
}
function ContextMenuSubContent({ ...props }) {
    return _jsx(ContextMenuContent, { "data-slot": "context-menu-sub-content", className: "shadow-lg", side: "right", ...props });
}
function ContextMenuCheckboxItem({ className, children, checked, inset, ...props }) {
    return (_jsxs(ContextMenuPrimitive.CheckboxItem, { "data-slot": "context-menu-checkbox-item", "data-inset": inset, className: cn("relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden focus:bg-cms-accent focus:text-cms-accent-foreground data-disabled:pointer-events-none data-inset:pl-8 data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0", className), checked: checked, ...props, children: [_jsx("span", { className: "pointer-events-none absolute right-2", children: _jsx(ContextMenuPrimitive.CheckboxItemIndicator, { children: _jsx(CheckIcon, {}) }) }), children] }));
}
function ContextMenuRadioGroup({ ...props }) {
    return _jsx(ContextMenuPrimitive.RadioGroup, { "data-slot": "context-menu-radio-group", ...props });
}
function ContextMenuRadioItem({ className, children, inset, ...props }) {
    return (_jsxs(ContextMenuPrimitive.RadioItem, { "data-slot": "context-menu-radio-item", "data-inset": inset, className: cn("relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden focus:bg-cms-accent focus:text-cms-accent-foreground data-disabled:pointer-events-none data-inset:pl-8 data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0", className), ...props, children: [_jsx("span", { className: "pointer-events-none absolute right-2", children: _jsx(ContextMenuPrimitive.RadioItemIndicator, { children: _jsx(CheckIcon, {}) }) }), children] }));
}
function ContextMenuSeparator({ className, ...props }) {
    return (_jsx(ContextMenuPrimitive.Separator, { "data-slot": "context-menu-separator", className: cn("-mx-1 my-1 h-px bg-cms-border", className), ...props }));
}
function ContextMenuShortcut({ className, ...props }) {
    return (_jsx("span", { "data-slot": "context-menu-shortcut", className: cn("ml-auto text-cms-muted-foreground text-xs tracking-widest group-focus/context-menu-item:text-cms-accent-foreground", className), ...props }));
}
export { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuCheckboxItem, ContextMenuRadioItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuGroup, ContextMenuPortal, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuRadioGroup, };
