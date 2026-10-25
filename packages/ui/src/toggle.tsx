"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

const toggleVariants = cva(
	"group/toggle inline-flex items-center justify-center gap-1 rounded-md text-monti-label whitespace-nowrap transition-[color,box-shadow] outline-none hover:bg-monti-hover hover:text-monti-default focus-visible:border-monti-focus focus-visible:ring-[3px] focus-visible:ring-monti-focus-soft disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-monti-danger aria-invalid:ring-monti-danger-soft aria-pressed:bg-monti-accent-muted aria-pressed:text-monti-accent [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				outline:
					"border border-monti-default bg-monti-surface shadow-monti-control hover:border-monti-emphasis hover:bg-monti-hover",
			},
			size: {
				default: "h-control min-w-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
				sm: "h-control-sm min-w-7 px-2 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
				lg: "h-control-lg min-w-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
				"icon-sm": "size-control-sm px-0",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Toggle({
	className,
	variant = "default",
	size = "default",
	...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
	return <TogglePrimitive data-slot="toggle" className={cn(toggleVariants({ variant, size, className }))} {...props} />;
}

export { Toggle, toggleVariants };
