import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

const badgeVariants = cva(
	"group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-2 py-0.5 text-monti-caption font-medium whitespace-nowrap transition-all focus-visible:border-monti-focus focus-visible:ring-[3px] focus-visible:ring-monti-focus-soft has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-monti-danger aria-invalid:ring-monti-danger monti-dark:aria-invalid:ring-monti-danger [&>svg]:pointer-events-none [&>svg]:size-3!",
	{
		variants: {
			variant: {
				default: "bg-monti-emphasis text-monti-on-emphasis [a]:hover:bg-monti-emphasis-hover",
				secondary: "bg-monti-neutral text-monti-default [a]:hover:bg-monti-neutral",
				destructive:
					"bg-monti-danger-muted text-monti-danger focus-visible:ring-monti-danger monti-dark:bg-monti-danger-muted monti-dark:focus-visible:ring-monti-danger [a]:hover:bg-monti-danger-muted",
				success: "bg-monti-success-muted text-monti-success",
				warning: "bg-monti-warning-muted text-monti-warning",
				outline: "border-monti-muted text-monti-default [a]:hover:bg-monti-hover [a]:hover:text-monti-muted",
				ghost: "hover:bg-monti-hover hover:text-monti-muted monti-dark:hover:bg-monti-hover",
				link: "text-monti-accent underline underline-offset-4",
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
