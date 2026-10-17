"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva } from "class-variance-authority";
import { cn } from "../lib/utils/index.js";
const toggleVariants = cva("group/toggle inline-flex items-center justify-center gap-1 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none hover:bg-monti-muted hover:text-monti-foreground focus-visible:border-monti-ring focus-visible:ring-[3px] focus-visible:ring-monti-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-monti-destructive aria-invalid:ring-monti-destructive/20 aria-pressed:bg-monti-muted monti-dark:aria-invalid:ring-monti-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", {
    variants: {
        variant: {
            default: "bg-transparent",
            outline: "border border-monti-input bg-transparent hover:bg-monti-muted",
        },
        size: {
            default: "h-9 min-w-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
            sm: "h-8 min-w-8 px-2.5 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
            lg: "h-10 min-w-10 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        },
    },
    defaultVariants: {
        variant: "default",
        size: "default",
    },
});
function Toggle({ className, variant = "default", size = "default", ...props }) {
    return _jsx(TogglePrimitive, { "data-slot": "toggle", className: cn(toggleVariants({ variant, size, className })), ...props });
}
export { Toggle, toggleVariants };
