import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";
import { Spinner } from "./spinner";

const buttonVariants = cva(
	"group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-monti-label whitespace-nowrap transition-all outline-none select-none focus-visible:border-monti-focus focus-visible:ring-3 focus-visible:ring-monti-focus-soft active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-monti-danger aria-invalid:ring-3 aria-invalid:ring-monti-danger-soft [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			/** How it looks: `default` solid, `outline`, `secondary` a soft fill, `ghost` no fill, `quiet` grey text that darkens on hover, `link`. */
			variant: {
				default: "bg-monti-emphasis text-monti-on-emphasis hover:bg-monti-emphasis-hover",
				outline:
					"border-monti-muted bg-monti-page hover:bg-monti-hover hover:text-monti-default aria-expanded:bg-monti-hover aria-expanded:text-monti-default monti-dark:border-monti-default",
				secondary:
					"bg-monti-neutral text-monti-default hover:bg-monti-active aria-expanded:bg-monti-neutral aria-expanded:text-monti-default",
				ghost:
					"hover:bg-monti-hover hover:text-monti-default aria-expanded:bg-monti-hover aria-expanded:text-monti-default",
				quiet:
					"text-monti-muted hover:bg-monti-hover hover:text-monti-default aria-expanded:bg-monti-hover aria-expanded:text-monti-default",
				link: "text-monti-accent underline-offset-4 hover:underline",
			},
			/** What it means. `danger` is for steps that remove or overwrite; it works with every look. */
			tone: { neutral: "", danger: "" },
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
		compoundVariants: [
			{
				tone: "danger",
				variant: "default",
				class: "bg-monti-danger-emphasis text-monti-on-emphasis hover:bg-monti-danger-emphasis-hover",
			},
			{
				tone: "danger",
				variant: "secondary",
				class: "bg-monti-danger-muted text-monti-danger hover:bg-monti-danger-muted",
			},
			{
				tone: "danger",
				variant: ["outline", "ghost", "quiet"],
				class: "text-monti-danger hover:bg-monti-danger-muted hover:text-monti-danger",
			},
			{ tone: "danger", variant: "outline", class: "border-monti-danger-muted" },
			{ tone: "danger", variant: "link", class: "text-monti-danger" },
		],
		defaultVariants: {
			variant: "default",
			tone: "neutral",
			size: "default",
		},
	},
);

function Button({
	className,
	variant = "default",
	tone = "neutral",
	size = "default",
	loading = false,
	width,
	disabled,
	children,
	...props
}: ButtonPrimitive.Props &
	VariantProps<typeof buttonVariants> & {
		/** Working on it: a spinner before the label, and the button cannot be pressed again. */
		loading?: boolean;
		/** `full` spans its container (a stacked form, a narrow panel). */
		width?: "full";
	}) {
	return (
		<ButtonPrimitive
			data-slot="button"
			data-loading={loading || undefined}
			aria-busy={loading || undefined}
			disabled={disabled || loading}
			className={cn(buttonVariants({ variant, tone, size }), width === "full" && "w-full", className)}
			{...props}
		>
			{loading && <Spinner size="sm" aria-hidden />}
			{children}
		</ButtonPrimitive>
	);
}

export { Button, buttonVariants };
