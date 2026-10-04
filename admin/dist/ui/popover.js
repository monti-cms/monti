"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "../lib/utils/index.js";
function Popover({ ...props }) {
    return _jsx(PopoverPrimitive.Root, { "data-slot": "popover", ...props });
}
function PopoverTrigger({ ...props }) {
    return _jsx(PopoverPrimitive.Trigger, { "data-slot": "popover-trigger", ...props });
}
function PopoverContent({ className, align = "center", alignOffset = 0, side = "bottom", sideOffset = 4, anchor, ...props }) {
    return (_jsx(PopoverPrimitive.Portal, { children: _jsx(PopoverPrimitive.Positioner, { anchor: anchor, align: align, alignOffset: alignOffset, side: side, sideOffset: sideOffset, className: "isolate z-50", children: _jsx(PopoverPrimitive.Popup, { "data-slot": "popover-content", className: cn("data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 z-50 flex w-72 origin-(--transform-origin) flex-col gap-4 rounded-md bg-cms-popover p-4 text-cms-popover-foreground text-sm shadow-md outline-hidden ring-1 ring-cms-foreground/10 duration-100 data-closed:animate-out data-open:animate-in", className), ...props }) }) }));
}
function PopoverHeader({ className, ...props }) {
    return _jsx("div", { "data-slot": "popover-header", className: cn("flex flex-col gap-1 text-sm", className), ...props });
}
function PopoverTitle({ className, ...props }) {
    return _jsx(PopoverPrimitive.Title, { "data-slot": "popover-title", className: cn("font-medium", className), ...props });
}
function PopoverDescription({ className, ...props }) {
    return (_jsx(PopoverPrimitive.Description, { "data-slot": "popover-description", className: cn("text-cms-muted-foreground", className), ...props }));
}
export { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger };
