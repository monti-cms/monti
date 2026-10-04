"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import * as React from "react";
import { cn } from "../lib/utils/index.js";
import { toggleVariants } from "./toggle.js";
const ToggleGroupContext = React.createContext({
    size: "default",
    variant: "default",
    spacing: 2,
    orientation: "horizontal",
});
function ToggleGroup({ className, variant, size, spacing = 2, orientation = "horizontal", children, ...props }) {
    return (_jsx(ToggleGroupPrimitive, { "data-slot": "toggle-group", "data-variant": variant, "data-size": size, "data-spacing": spacing, "data-orientation": orientation, style: { "--gap": spacing }, className: cn("group/toggle-group flex w-fit flex-row cms-vertical:flex-col items-center cms-vertical:items-stretch gap-[--spacing(var(--gap))] rounded-md data-[spacing=0]:data-[variant=outline]:shadow-xs", className), ...props, children: _jsx(ToggleGroupContext.Provider, { value: { variant, size, spacing, orientation }, children: children }) }));
}
function ToggleGroupItem({ className, children, variant = "default", size = "default", ...props }) {
    const context = React.useContext(ToggleGroupContext);
    return (_jsx(TogglePrimitive, { "data-slot": "toggle-group-item", "data-variant": context.variant || variant, "data-size": context.size || size, "data-spacing": context.spacing, className: cn("shrink-0 focus:z-10 focus-visible:z-10 data-[state=on]:bg-cms-muted group-cms-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-cms-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-cms-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-md group-cms-vertical/toggle-group:data-[spacing=0]:last:rounded-b-md group-cms-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t group-cms-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-cms-vertical/toggle-group:data-[spacing=0]:first:rounded-t-md group-cms-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-md group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2 group-data-[spacing=0]/toggle-group:shadow-none group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pr-1.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:pl-1.5", toggleVariants({
            variant: context.variant || variant,
            size: context.size || size,
        }), className), ...props, children: children }));
}
export { ToggleGroup, ToggleGroupItem };
