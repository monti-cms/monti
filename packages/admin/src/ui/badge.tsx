import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const badgeVariants = cva(
	"group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-cms-ring focus-visible:ring-[3px] focus-visible:ring-cms-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-cms-destructive aria-invalid:ring-cms-destructive/20 cms-dark:aria-invalid:ring-cms-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
	{
		variants: {
			variant: {
				default: "bg-cms-primary text-cms-primary-foreground [a]:hover:bg-cms-primary/80",
				secondary: "bg-cms-secondary text-cms-secondary-foreground [a]:hover:bg-cms-secondary/80",
				destructive:
					"bg-cms-destructive/10 text-cms-destructive focus-visible:ring-cms-destructive/20 cms-dark:bg-cms-destructive/20 cms-dark:focus-visible:ring-cms-destructive/40 [a]:hover:bg-cms-destructive/20",
				outline: "border-cms-border text-cms-foreground [a]:hover:bg-cms-muted [a]:hover:text-cms-muted-foreground",
				ghost: "hover:bg-cms-muted hover:text-cms-muted-foreground cms-dark:hover:bg-cms-muted/50",
				link: "text-cms-primary underline-offset-4 hover:underline",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Badge({
	className,
	variant = "default",
	render,
	...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return useRender({
		defaultTagName: "span",
		props: mergeProps<"span">(
			{
				className: cn(badgeVariants({ variant }), className),
			},
			props,
		),
		render,
		state: {
			slot: "badge",
			variant,
		},
	});
}

export { Badge, badgeVariants };
