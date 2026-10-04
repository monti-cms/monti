import { jsx as _jsx } from "react/jsx-runtime";
import { cva } from "class-variance-authority";
import { cn } from "../lib/utils/index.js";
/**
 * Alert box for the admin UI. `default` is for notices, `danger` for errors such as a load failure.
 * The look of body blocks (callouts, etc.) is decided by each block separately.
 */
export const alertVariants = cva([
    "relative w-full rounded-lg border px-4 py-3 text-sm",
    "[&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
].join(" "), {
    variants: {
        layout: {
            grid: "grid grid-cols-[calc(var(--spacing)*4)_1fr] gap-x-3 gap-y-1 items-start",
            stack: "block",
        },
        variant: {
            default: "border-cms-border bg-cms-card text-cms-card-foreground",
            danger: [
                "bg-red-50 text-red-900 border-red-200 [&>svg]:text-red-700",
                "cms-dark:bg-red-400/25 cms-dark:text-red-50 cms-dark:border-red-300/70 cms-dark:[&>svg]:text-red-100",
            ].join(" "),
        },
    },
    defaultVariants: {
        layout: "grid",
        variant: "default",
    },
});
function Alert({ className, layout, variant, ...props }) {
    return (_jsx("div", { "data-slot": "alert", role: "alert", className: cn(alertVariants({ layout, variant }), className), ...props }));
}
function AlertTitle({ className, ...props }) {
    return (_jsx("div", { "data-slot": "alert-title", className: cn("col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight", className), ...props }));
}
function AlertDescription({ className, ...props }) {
    return (_jsx("div", { "data-slot": "alert-description", className: cn("col-start-2 grid justify-items-start gap-1 text-cms-muted-foreground text-sm [&_p]:leading-relaxed", className), ...props }));
}
export { Alert, AlertTitle, AlertDescription };
