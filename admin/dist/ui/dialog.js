"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { createTranslator } from "@monti-cms/core/client";
import { XIcon } from "lucide-react";
import { cn } from "../lib/utils/index.js";
import { Button } from "./button.js";
import { uiMessages } from "./messages.js";
const t = createTranslator(uiMessages);
function Dialog({ ...props }) {
    return _jsx(DialogPrimitive.Root, { "data-slot": "dialog", ...props });
}
function DialogTrigger({ ...props }) {
    return _jsx(DialogPrimitive.Trigger, { "data-slot": "dialog-trigger", ...props });
}
function DialogPortal({ ...props }) {
    return _jsx(DialogPrimitive.Portal, { "data-slot": "dialog-portal", ...props });
}
function DialogClose({ ...props }) {
    return _jsx(DialogPrimitive.Close, { "data-slot": "dialog-close", ...props });
}
function DialogOverlay({ className, ...props }) {
    return (_jsx(DialogPrimitive.Backdrop, { "data-slot": "dialog-overlay", className: cn("data-open:fade-in-0 data-closed:fade-out-0 fixed inset-0 isolate z-50 bg-black/10 duration-100 data-closed:animate-out data-open:animate-in supports-backdrop-filter:backdrop-blur-xs", className), ...props }));
}
function DialogContent({ className, children, showCloseButton = true, ...props }) {
    return (_jsxs(DialogPortal, { children: [_jsx(DialogOverlay, {}), _jsxs(DialogPrimitive.Popup, { "data-slot": "dialog-content", className: cn("data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-xl bg-cms-popover p-6 text-cms-popover-foreground text-sm outline-none ring-1 ring-cms-foreground/10 duration-100 data-closed:animate-out data-open:animate-in sm:max-w-md", className), ...props, children: [children, showCloseButton && (_jsxs(DialogPrimitive.Close, { "data-slot": "dialog-close", render: _jsx(Button, { variant: "ghost", className: "absolute top-4 right-4", size: "icon-sm" }), children: [_jsx(XIcon, {}), _jsx("span", { className: "sr-only", children: t("close") })] }))] })] }));
}
function DialogHeader({ className, ...props }) {
    return _jsx("div", { "data-slot": "dialog-header", className: cn("flex flex-col gap-2", className), ...props });
}
function DialogFooter({ className, showCloseButton = false, children, ...props }) {
    return (_jsxs("div", { "data-slot": "dialog-footer", className: cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className), ...props, children: [children, showCloseButton && _jsx(DialogPrimitive.Close, { render: _jsx(Button, { variant: "outline" }), children: "Close" })] }));
}
function DialogTitle({ className, ...props }) {
    return (_jsx(DialogPrimitive.Title, { "data-slot": "dialog-title", className: cn("font-medium leading-none", className), ...props }));
}
function DialogDescription({ className, ...props }) {
    return (_jsx(DialogPrimitive.Description, { "data-slot": "dialog-description", className: cn("text-cms-muted-foreground text-sm *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-cms-foreground", className), ...props }));
}
export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger, };
