import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

const buttonVariants = cva(
	"group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-monti-label whitespace-nowrap transition-all outline-none select-none focus-visible:border-monti-focus focus-visible:ring-3 focus-visible:ring-monti-focus-soft active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-monti-danger aria-invalid:ring-3 aria-invalid:ring-monti-danger monti-dark:aria-invalid:border-monti-danger-muted monti-dark:aria-invalid:ring-monti-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default: "bg-monti-emphasis text-monti-on-emphasis hover:bg-monti-emphasis-hover",
				outline:
					"border-monti-muted bg-monti-page hover:bg-monti-hover hover:text-monti-default aria-expanded:bg-monti-hover aria-expanded:text-monti-default monti-dark:border-monti-default",
				secondary:
					"bg-monti-neutral text-monti-default hover:bg-monti-active aria-expanded:bg-monti-neutral aria-expanded:text-monti-default",
				ghost:
					"hover:bg-monti-hover hover:text-monti-default aria-expanded:bg-monti-hover aria-expanded:text-monti-default monti-dark:hover:bg-monti-hover",
				destructive:
					"bg-monti-danger-muted text-monti-danger hover:bg-monti-danger-muted focus-visible:border-monti-danger-muted focus-visible:ring-monti-danger monti-dark:bg-monti-danger-muted monti-dark:hover:bg-monti-danger-muted monti-dark:focus-visible:ring-monti-danger",
				link: "text-monti-accent underline-offset-4 hover:underline",
			},
			size: {
				default:
					"h-9 gap-1.5 px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
				xs: "h-6 gap-1 rounded-md px-2 text-monti-caption in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-8 gap-1 rounded-md px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
				lg: "h-10 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
				icon: "size-9",
				"icon-xs": "size-6 rounded-md in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "size-8 rounded-md in-data-[slot=button-group]:rounded-md",
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
