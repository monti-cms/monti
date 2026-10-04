"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { createTranslator } from "@monti-cms/core/client";
import { XIcon } from "lucide-react";
import { cn } from "../lib/utils/index.js";
import { Button } from "./button.js";
import { uiMessages } from "./messages.js";
const t = createTranslator(uiMessages);
function Sheet({ ...props }) {
    return _jsx(SheetPrimitive.Root, { "data-slot": "sheet", ...props });
}
function SheetTrigger({ ...props }) {
    return _jsx(SheetPrimitive.Trigger, { "data-slot": "sheet-trigger", ...props });
}
function SheetClose({ ...props }) {
    return _jsx(SheetPrimitive.Close, { "data-slot": "sheet-close", ...props });
}
function SheetPortal({ ...props }) {
    return _jsx(SheetPrimitive.Portal, { "data-slot": "sheet-portal", ...props });
}
function SheetOverlay({ className, ...props }) {
    return (_jsx(SheetPrimitive.Backdrop, { "data-slot": "sheet-overlay", className: cn("fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs", className), ...props }));
}
function SheetContent({ className, children, side = "right", showCloseButton = true, ...props }) {
    return (_jsxs(SheetPortal, { children: [_jsx(SheetOverlay, {}), _jsxs(SheetPrimitive.Popup, { "data-slot": "sheet-content", "data-side": side, className: cn("fixed z-50 flex flex-col gap-4 bg-cms-popover bg-clip-padding text-cms-popover-foreground text-sm shadow-lg transition duration-200 ease-in-out data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem] data-[side=bottom]:inset-x-0 data-[side=top]:inset-x-0 data-[side=left]:inset-y-0 data-[side=right]:inset-y-0 data-[side=top]:top-0 data-[side=right]:right-0 data-[side=bottom]:bottom-0 data-[side=left]:left-0 data-[side=bottom]:h-auto data-[side=left]:h-full data-[side=right]:h-full data-[side=top]:h-auto data-[side=left]:w-3/4 data-[side=right]:w-3/4 data-[side=bottom]:border-t data-[side=left]:border-r data-[side=top]:border-b data-[side=right]:border-l data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm", className), ...props, children: [children, showCloseButton && (_jsxs(SheetPrimitive.Close, { "data-slot": "sheet-close", render: _jsx(Button, { variant: "ghost", className: "absolute top-4 right-4", size: "icon-sm" }), children: [_jsx(XIcon, {}), _jsx("span", { className: "sr-only", children: t("close") })] }))] })] }));
}
function SheetHeader({ className, ...props }) {
    return _jsx("div", { "data-slot": "sheet-header", className: cn("flex flex-col gap-1.5 p-4", className), ...props });
}
function SheetFooter({ className, ...props }) {
    return _jsx("div", { "data-slot": "sheet-footer", className: cn("mt-auto flex flex-col gap-2 p-4", className), ...props });
}
function SheetTitle({ className, ...props }) {
    return (_jsx(SheetPrimitive.Title, { "data-slot": "sheet-title", className: cn("font-medium text-cms-foreground", className), ...props }));
}
function SheetDescription({ className, ...props }) {
    return (_jsx(SheetPrimitive.Description, { "data-slot": "sheet-description", className: cn("text-cms-muted-foreground text-sm", className), ...props }));
}
export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription };
