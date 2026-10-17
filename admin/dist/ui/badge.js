import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva } from "class-variance-authority";
import { cn } from "../lib/utils/index.js";
const badgeVariants = cva("group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-monti-ring focus-visible:ring-[3px] focus-visible:ring-monti-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-monti-destructive aria-invalid:ring-monti-destructive/20 monti-dark:aria-invalid:ring-monti-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!", {
    variants: {
        variant: {
            default: "bg-monti-primary text-monti-primary-foreground [a]:hover:bg-monti-primary/80",
            secondary: "bg-monti-secondary text-monti-secondary-foreground [a]:hover:bg-monti-secondary/80",
            destructive: "bg-monti-destructive/10 text-monti-destructive focus-visible:ring-monti-destructive/20 monti-dark:bg-monti-destructive/20 monti-dark:focus-visible:ring-monti-destructive/40 [a]:hover:bg-monti-destructive/20",
            success: "bg-monti-success-soft text-monti-success-foreground",
            warning: "bg-monti-warning-soft text-monti-warning-foreground",
            outline: "border-monti-border text-monti-foreground [a]:hover:bg-monti-muted [a]:hover:text-monti-muted-foreground",
            ghost: "hover:bg-monti-muted hover:text-monti-muted-foreground monti-dark:hover:bg-monti-muted/50",
            link: "text-monti-primary underline-offset-4 hover:underline",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});
function Badge({ className, variant = "default", render, ...props }) {
    return useRender({
        defaultTagName: "span",
        props: mergeProps({
            className: cn(badgeVariants({ variant }), className),
        }, props),
        render,
        state: {
            slot: "badge",
            variant,
        },
    });
}
export { Badge, badgeVariants };
