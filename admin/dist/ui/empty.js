import { jsx as _jsx } from "react/jsx-runtime";
import { cva } from "class-variance-authority";
import { cn } from "../lib/utils/index.js";
function Empty({ className, ...props }) {
    return (_jsx("div", { "data-slot": "empty", className: cn("flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 text-balance rounded-lg border-dashed p-12 text-center", className), ...props }));
}
function EmptyHeader({ className, ...props }) {
    return (_jsx("div", { "data-slot": "empty-header", className: cn("flex max-w-sm flex-col items-center gap-2", className), ...props }));
}
const emptyMediaVariants = cva("mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0", {
    variants: {
        variant: {
            default: "bg-transparent",
            icon: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-cms-muted text-cms-foreground [&_svg:not([class*='size-'])]:size-6",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});
function EmptyMedia({ className, variant = "default", ...props }) {
    return (_jsx("div", { "data-slot": "empty-icon", "data-variant": variant, className: cn(emptyMediaVariants({ variant, className })), ...props }));
}
function EmptyTitle({ className, ...props }) {
    return _jsx("div", { "data-slot": "empty-title", className: cn("font-medium text-lg tracking-tight", className), ...props });
}
function EmptyDescription({ className, ...props }) {
    return (_jsx("div", { "data-slot": "empty-description", className: cn("text-cms-muted-foreground text-sm/relaxed [&>a:hover]:text-cms-primary [&>a]:underline [&>a]:underline-offset-4", className), ...props }));
}
function EmptyContent({ className, ...props }) {
    return (_jsx("div", { "data-slot": "empty-content", className: cn("flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-balance text-sm", className), ...props }));
}
export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia };
