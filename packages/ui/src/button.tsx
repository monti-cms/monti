import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

/**
 * A pill. One `primary` per screen or floating surface, then `secondary` for the one or two common side actions, `danger` only to confirm
 * something that cannot be undone, and `outline-danger` for a quieter version of it. The text is centered by the font (no padding nudge), and a
 * leading icon pulls 2px into the left padding so it centers visually. The filled pills have no border, so their text starts at the padding the
 * design system gives (18px, 16px for `secondary`, 12px for `sm`); only `outline-danger` draws a 1px line.
 * A button that is `loading` keeps its fill and its place: the caller changes the label to say what is happening ("Saving…", "Uploading 64%"); it cannot be pressed again, and its cursor says so.
 */
const buttonVariants = cva(
	"group/button inline-flex shrink-0 items-center justify-center gap-monti-6 rounded-monti-full whitespace-nowrap outline-none transition-colors select-none focus-visible:ring-3 focus-visible:ring-monti-contrast/20 disabled:pointer-events-none disabled:opacity-45 aria-disabled:cursor-default aria-disabled:opacity-45 data-loading:pointer-events-auto data-loading:cursor-not-allowed data-loading:opacity-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&>svg:first-child]:-ml-[2px]",
	{
		variants: {
			variant: {
				/** The one main action of a screen or a floating surface. */
				primary:
					"bg-monti-emphasis px-[18px] font-semibold text-monti-on-emphasis not-data-loading:hover:bg-monti-emphasis/90",
				/** A common side action. */
				secondary: "bg-monti-muted px-[16px] font-normal text-monti-muted not-data-loading:hover:bg-monti-selected",
				/** Confirms something that cannot be undone. Only inside a confirmation. */
				danger:
					"bg-monti-danger-emphasis px-[18px] font-semibold text-monti-on-emphasis not-data-loading:hover:bg-monti-danger-emphasis/90",
				/** The quiet version of `danger`. */
				"outline-danger":
					"border border-monti-danger px-[18px] font-medium text-monti-danger not-data-loading:hover:bg-monti-danger-muted",
			},
			/** `md` 36px; `sm` 28px inside cards and panels. */
			size: {
				md: "h-monti-control-md text-monti-body",
				sm: "h-monti-control-sm px-[12px] text-monti-note",
			},
		},
		defaultVariants: { variant: "primary", size: "md" },
	},
);

function Button({
	className,
	variant,
	size,
	loading = false,
	width,
	disabled,
	children,
	...props
}: ButtonPrimitive.Props &
	VariantProps<typeof buttonVariants> & {
		/** Working on it: the button keeps its fill (it is not dimmed like a disabled one) and cannot be pressed again. Put the progress in the label. */
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
			className={cn(buttonVariants({ variant, size }), width === "full" && "w-full", className)}
			{...props}
		>
			{children}
		</ButtonPrimitive>
	);
}

export { Button };
