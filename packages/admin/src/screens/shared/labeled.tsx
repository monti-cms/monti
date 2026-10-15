import type { ReactNode } from "react";
import { cn } from "../../lib/utils/cn";
import { FieldDescription, FieldLabel, Field as UiField } from "../../ui/field";

/** How wide the control of a field is: short values and choices stay narrow, text takes more, a list or a row of controls takes the whole width. */
export const CONTROL_WIDTH = { narrow: "max-w-sm", normal: "max-w-xl", wide: "max-w-2xl", full: "" } as const;
/** The longest line of a help text: it spans the card, but never wider than is comfortable to read. */
export const HELP = "max-w-[70ch] text-xs";

export function Labeled({
	label,
	description,
	hint,
	children,
	htmlFor,
	className,
	control = "normal",
}: {
	label: ReactNode;
	/** A field description explaining what the setting is, placed between label and control. */
	description?: ReactNode;
	/** An input hint or helper text, placed beneath the control. */
	hint?: ReactNode;
	htmlFor?: string;
	children: ReactNode;
	className?: string;
	control?: keyof typeof CONTROL_WIDTH;
}) {
	return (
		<UiField className={cn("gap-2", className)}>
			<FieldLabel htmlFor={htmlFor} className="font-medium text-sm">
				{label}
			</FieldLabel>
			{description && <FieldDescription className={HELP}>{description}</FieldDescription>}
			<div className={cn("w-full", CONTROL_WIDTH[control])}>{children}</div>
			{hint && <FieldDescription className={HELP}>{hint}</FieldDescription>}
		</UiField>
	);
}
