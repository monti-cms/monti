import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";
import type { MontiIcon } from "./monti-icon";

/** An icon outside a button (a severity mark, a file type, a hint), sized and colored by name. Decorative unless it has a `label`. */
const iconVariants = cva("shrink-0", {
	variants: {
		size: { xs: "size-monti-icon-xs", sm: "size-monti-icon-sm", md: "size-monti-icon-md", lg: "size-monti-icon-lg" },
		tone: {
			inherit: "",
			muted: "text-monti-muted",
			subtle: "text-monti-subtle",
			danger: "text-monti-danger",
			warning: "text-monti-warning",
			success: "text-monti-success",
		},
	},
	defaultVariants: { size: "md", tone: "inherit" },
});

function Icon({
	icon: Glyph,
	label,
	size,
	tone,
	className,
}: VariantProps<typeof iconVariants> & { icon: MontiIcon; label?: string; className?: string }) {
	return (
		<Glyph
			data-slot="icon"
			aria-hidden={label ? undefined : true}
			aria-label={label}
			role={label ? "img" : undefined}
			className={cn(iconVariants({ size, tone }), className)}
		/>
	);
}

export { Icon };
