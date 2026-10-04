"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Command as CommandPrimitive } from "cmdk";
import { CheckIcon, SearchIcon } from "lucide-react";
import { cn } from "../lib/utils/index.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog.js";
import { InputGroup, InputGroupAddon } from "./input-group.js";
function Command({ className, ...props }) {
    return (_jsx(CommandPrimitive, { "data-slot": "command", className: cn("flex size-full flex-col overflow-hidden rounded-xl! bg-cms-popover p-1 text-cms-popover-foreground", className), ...props }));
}
function CommandDialog({ title = "Command Palette", description = "Search for a command to run...", children, className, showCloseButton = false, ...props }) {
    return (_jsxs(Dialog, { ...props, children: [_jsxs(DialogHeader, { className: "sr-only", children: [_jsx(DialogTitle, { children: title }), _jsx(DialogDescription, { children: description })] }), _jsx(DialogContent, { className: cn("top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0", className), showCloseButton: showCloseButton, children: children })] }));
}
function CommandInput({ className, ...props }) {
    return (_jsx("div", { "data-slot": "command-input-wrapper", className: "p-1 pb-0", children: _jsxs(InputGroup, { className: "h-8! rounded-lg! border-cms-input/30 bg-cms-input/30 shadow-none! *:data-[slot=input-group-addon]:pl-2!", children: [_jsx(CommandPrimitive.Input, { "data-slot": "command-input", className: cn("w-full text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50", className), ...props }), _jsx(InputGroupAddon, { children: _jsx(SearchIcon, { className: "size-4 shrink-0 opacity-50" }) })] }) }));
}
function CommandList({ className, ...props }) {
    return (_jsx(CommandPrimitive.List, { "data-slot": "command-list", className: cn("no-scrollbar max-h-72 scroll-py-1 overflow-y-auto overflow-x-hidden outline-none", className), ...props }));
}
function CommandEmpty({ className, ...props }) {
    return (_jsx(CommandPrimitive.Empty, { "data-slot": "command-empty", className: cn("py-6 text-center text-sm", className), ...props }));
}
function CommandGroup({ className, ...props }) {
    return (_jsx(CommandPrimitive.Group, { "data-slot": "command-group", className: cn("overflow-hidden p-1 text-cms-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-cms-muted-foreground **:[[cmdk-group-heading]]:text-xs", className), ...props }));
}
function CommandSeparator({ className, ...props }) {
    return (_jsx(CommandPrimitive.Separator, { "data-slot": "command-separator", className: cn("-mx-1 h-px w-auto bg-cms-border", className), ...props }));
}
function CommandItem({ className, children, ...props }) {
    return (_jsxs(CommandPrimitive.Item, { "data-slot": "command-item", className: cn("group/command-item relative flex cursor-default select-none items-center gap-2 in-data-[slot=dialog-content]:rounded-lg! rounded-sm px-2 py-1.5 text-sm outline-hidden data-[disabled=true]:pointer-events-none data-[selected=true]:bg-cms-accent data-[selected=true]:text-cms-accent-foreground data-[disabled=true]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-[selected=true]:**:[svg]:text-cms-foreground", className), ...props, children: [children, _jsx(CheckIcon, { className: "ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" })] }));
}
function CommandShortcut({ className, ...props }) {
    return (_jsx("span", { "data-slot": "command-shortcut", className: cn("ml-auto text-cms-muted-foreground text-xs tracking-widest group-data-[selected=true]/command-item:text-cms-foreground", className), ...props }));
}
export { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut, CommandSeparator, };
