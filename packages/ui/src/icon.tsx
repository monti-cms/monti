import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";

/** An icon outside a button (a severity mark, a file type, a hint), sized and colored by name. Decorative unless it has a `label`. */
const iconVariants = cva("shrink-0", {
	variants: {
		size: { xs: "size-icon-xs", sm: "size-icon-sm", md: "size-icon", lg: "size-icon-lg" },
		tone: {
			inherit: "",
			muted: "text-monti-muted",
			subtle: "text-monti-subtle",
			accent: "text-monti-accent",
			danger: "text-monti-danger",
			warning: "text-monti-warning",
			success: "text-monti-success",
		},
		spin: { true: "animate-spin" },
	},
	defaultVariants: { size: "md", tone: "inherit" },
});

function Icon({
	icon: Glyph,
	label,
	size,
	tone,
	spin,
	className,
}: VariantProps<typeof iconVariants> & { icon: LucideIcon; label?: string; className?: string }) {
	return (
		<Glyph
			data-slot="icon"
			aria-hidden={label ? undefined : true}
			aria-label={label}
			role={label ? "img" : undefined}
			className={cn(iconVariants({ size, tone, spin }), className)}
		/>
	);
}

export { Icon };
