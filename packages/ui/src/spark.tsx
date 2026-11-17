import { forwardRef } from "react";
import { cn } from "./cn";
import type { MontiIcon } from "./monti-icon";

/**
 * The one mark for the assistant: a four-point star ✦. It is an icon like the Carbon ones (it fits wherever a `MontiIcon` does: `<Icon icon={Spark}>`,
 * a button's icon, an `AdminPanel.icon`), so a parent that sizes its icons sizes it. It is filled with `currentColor`, so it follows the text it stands next
 * to (the proposal blue on a proposal, the button's ink on a button), and it is decorative: the words next to it say what it means. Every place that marks
 * something as the assistant's uses this, never a sparkles icon from an icon set.
 */
export const Spark: MontiIcon = forwardRef<SVGSVGElement, React.ComponentProps<MontiIcon>>(
	({ className, size = 16, ...props }, ref) => (
		<svg
			ref={ref}
			data-slot="spark"
			aria-hidden="true"
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="currentColor"
			className={cn("shrink-0", className)}
			{...props}
		>
			<path d="M12 2.25l2.55 7.2 7.2 2.55-7.2 2.55L12 21.75l-2.55-7.2L2.25 12l7.2-2.55z" />
		</svg>
	),
);
Spark.displayName = "Spark";
