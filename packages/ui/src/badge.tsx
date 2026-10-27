import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

const badgeVariants = cva(
	"group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-monti-sm border border-transparent px-2 py-0.5 text-monti-caption font-medium whitespace-nowrap transition-all focus-visible:border-monti-contrast focus-visible:ring-[3px] focus-visible:ring-monti-contrast/20 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-monti-danger aria-invalid:ring-monti-danger/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
	{
		variants: {
			variant: {
				default: "bg-monti-emphasis text-monti-on-emphasis [a]:hover:bg-monti-emphasis/90",
				secondary: "border-monti-muted bg-monti-muted text-monti-default [a]:hover:bg-monti-selected",
				danger:
					"border-monti-danger/40 bg-monti-danger-muted text-monti-danger focus-visible:ring-monti-danger monti-dark:bg-monti-danger-muted monti-dark:focus-visible:ring-monti-danger [a]:hover:bg-monti-danger-muted",
				success: "border-monti-success/40 bg-monti-success-muted text-monti-success",
				warning: "border-monti-warning/40 bg-monti-warning-muted text-monti-warning",
				outline:
					"border-monti-default bg-monti-page text-monti-default [a]:hover:bg-monti-selected [a]:hover:text-monti-muted",
				dashed: "border-monti-default border-dashed text-monti-subtle",
				ghost: "hover:bg-monti-selected hover:text-monti-muted monti-dark:hover:bg-monti-selected",
				link: "text-monti-default underline underline-offset-4",
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
	mono = false,
	render,
	...props
}: useRender.ComponentProps<"span"> &
	VariantProps<typeof badgeVariants> & {
		/** Fixed-width letters, for a code or a count. */
		mono?: boolean;
	}) {
	return useRender({
		defaultTagName: "span",
		props: mergeProps<"span">(
			{
				className: cn(badgeVariants({ variant }), mono && "font-mono", className),
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
