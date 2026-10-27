import { createLucideIcon, type LucideIcon } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "./cn";

const Star = createLucideIcon("spark", [
	["path", { d: "M12 2.25l2.55 7.2 7.2 2.55-7.2 2.55L12 21.75l-2.55-7.2L2.25 12l7.2-2.55z" }],
]);

/**
 * The one mark for the assistant: a four-point star ✦. It is an icon like the lucide ones (it fits wherever a `LucideIcon` does: `<Icon icon={Spark}>`,
 * a button's icon, an `AdminPanel.icon`), so a parent that sizes its icons sizes it. It is filled with `currentColor`, so it follows the text it stands next
 * to (the proposal blue on a proposal, the button's ink on a button), and it is decorative: the words next to it say what it means. Every place that marks
 * something as the assistant's uses this, never a lucide sparkles icon.
 */
export const Spark: LucideIcon = forwardRef<SVGSVGElement, React.ComponentProps<LucideIcon>>(
	({ className, ...props }, ref) => (
		<Star
			ref={ref}
			data-slot="spark"
			aria-hidden="true"
			fill="currentColor"
			stroke="none"
			className={cn("shrink-0", className)}
			{...props}
		/>
	),
);
Spark.displayName = "Spark";
