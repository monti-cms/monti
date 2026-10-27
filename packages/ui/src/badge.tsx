import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

/** A static label, never a control: a pill with one weight of fill. Color is for state only (danger, success, warning); everything else is gray. */
const badgeVariants = cva(
	"inline-flex h-5 w-fit shrink-0 items-center justify-center gap-monti-4 overflow-hidden rounded-monti-full border border-transparent px-monti-8 text-monti-caption font-medium whitespace-nowrap has-data-[icon=inline-end]:pr-monti-6 has-data-[icon=inline-start]:pl-monti-6 [&>svg]:pointer-events-none [&>svg]:size-3!",
	{
		variants: {
			variant: {
				default: "bg-monti-emphasis text-monti-on-emphasis",
				secondary: "bg-monti-muted text-monti-default",
				outline: "border-monti-default text-monti-default",
				dashed: "border-monti-default border-dashed text-monti-subtle",
				danger: "bg-monti-danger-muted text-monti-danger",
				success: "bg-monti-success-muted text-monti-success",
				warning: "bg-monti-warning-muted text-monti-warning",
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
