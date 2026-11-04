"use client";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cn } from "./cn";

function Separator({
	className,
	orientation = "horizontal",
	length = "full",
	flush = false,
	label,
	...props
}: SeparatorPrimitive.Props & {
	/**
	 * A vertical separator's height: `full` stretches to the row, `control` is the design system's 14px rule, centered (in a toolbar), and `bar` the 16px
	 * rule between two groups of a floating bar, 3px from each.
	 */
	length?: "full" | "control" | "bar";
	/** No room of its own at its sides: the row's gap spaces it (a page toolbar, a bulk bar). */
	flush?: boolean;
	/** A horizontal rule with a word in its middle ("또는", between two ways to sign in): the caption size, faint, 12px from each side's line. (cms-allow-korean: quotes the words) */
	label?: string;
}) {
	if (label && orientation === "horizontal")
		return (
			<SeparatorPrimitive
				data-slot="separator"
				orientation={orientation}
				aria-label={label}
				className={cn(
					"flex w-full items-center gap-monti-12 text-monti-caption text-monti-faint before:h-px before:flex-1 before:bg-(--monti-border-default) before:content-[''] after:h-px after:flex-1 after:bg-(--monti-border-default) after:content-['']",
					className,
				)}
				{...props}
			>
				<span aria-hidden>{label}</span>
			</SeparatorPrimitive>
		);
	return (
		<SeparatorPrimitive
			data-slot="separator"
			orientation={orientation}
			className={cn(
				"monti-horizontal:h-px monti-horizontal:w-full monti-vertical:w-px shrink-0",
				// A line between rows is the quiet row line; the rule between two controls is the design system's `border-default`, 1 by 14.
				length === "full"
					? "monti-vertical:self-stretch bg-monti-divider"
					: length === "bar"
						? "monti-vertical:mx-[3px] monti-vertical:h-4 monti-vertical:self-center bg-(--monti-border-default)"
						: "monti-vertical:mx-monti-4 monti-vertical:h-3.5 monti-vertical:self-center bg-(--monti-border-default)",
				flush && "monti-vertical:mx-0",
				className,
			)}
			{...props}
		/>
	);
}

export { Separator };
