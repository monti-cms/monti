import { cn } from "./cn";

/**
 * A 6px dot after a name: this one has something to deal with. `warning` is an unsaved change (a settings tab, a nav item, a language),
 * `proposal` is something the assistant suggested. The meaning must also be in words nearby or in `label`; color alone does not carry it.
 */
function ChangeDot({
	tone = "warning",
	label,
	className,
}: {
	tone?: "warning" | "proposal";
	/** The name for screen readers. Without it the dot is decorative. */
	label?: string;
	className?: string;
}) {
	const classes = cn(
		"inline-block size-1.5 shrink-0 rounded-monti-full",
		tone === "warning" ? "bg-(--monti-fg-warning)" : "bg-(--monti-fg-proposal)",
		className,
	);
	if (label) return <span data-slot="change-dot" role="img" aria-label={label} className={classes} />;
	return <span data-slot="change-dot" aria-hidden="true" className={classes} />;
}

export { ChangeDot };
