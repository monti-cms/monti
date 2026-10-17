import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const buttonVariants = cva(
	"group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-monti-ring focus-visible:ring-3 focus-visible:ring-monti-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-monti-destructive aria-invalid:ring-3 aria-invalid:ring-monti-destructive/20 monti-dark:aria-invalid:border-monti-destructive/50 monti-dark:aria-invalid:ring-monti-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default: "bg-monti-primary text-monti-primary-foreground hover:bg-monti-primary/80",
				outline:
					"border-monti-border bg-monti-background hover:bg-monti-muted hover:text-monti-foreground aria-expanded:bg-monti-muted aria-expanded:text-monti-foreground monti-dark:border-monti-input monti-dark:bg-monti-input/30 monti-dark:hover:bg-monti-input/50",
				secondary:
					"bg-monti-secondary text-monti-secondary-foreground hover:bg-[color-mix(in_oklch,var(--monti-secondary),var(--monti-foreground)_5%)] aria-expanded:bg-monti-secondary aria-expanded:text-monti-secondary-foreground",
				ghost:
					"hover:bg-monti-muted hover:text-monti-foreground aria-expanded:bg-monti-muted aria-expanded:text-monti-foreground monti-dark:hover:bg-monti-muted/50",
				destructive:
					"bg-monti-destructive/10 text-monti-destructive hover:bg-monti-destructive/20 focus-visible:border-monti-destructive/40 focus-visible:ring-monti-destructive/20 monti-dark:bg-monti-destructive/20 monti-dark:hover:bg-monti-destructive/30 monti-dark:focus-visible:ring-monti-destructive/40",
				link: "text-monti-primary underline-offset-4 hover:underline",
			},
			size: {
				default:
					"h-9 gap-1.5 px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
				xs: "h-6 gap-1 rounded-[min(var(--radius-md),8px)] px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-8 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
				lg: "h-10 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
				icon: "size-9",
				"icon-xs":
					"size-6 rounded-[min(var(--radius-md),8px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "size-8 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md",
				"icon-lg": "size-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant = "default",
	size = "default",
	...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
	return <ButtonPrimitive data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
