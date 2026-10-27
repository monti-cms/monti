"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon } from "lucide-react";
import { cn } from "./cn";

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
	return (
		<CheckboxPrimitive.Root
			data-slot="checkbox"
			className={cn(
				"peer relative flex size-4 shrink-0 items-center justify-center rounded-monti-sm border border-monti-default bg-monti-page outline-none transition-[border-color,background-color,box-shadow] after:absolute after:-inset-x-3 after:-inset-y-2 hover:border-monti-emphasis focus-visible:border-monti-contrast focus-visible:ring-3 focus-visible:ring-monti-contrast/20 disabled:cursor-not-allowed disabled:opacity-50 group-has-[:focus-visible]/field-label:not-data-checked:border-monti-default group-has-disabled/field:opacity-50 group-has-[:focus-visible]/field-label:ring-0 aria-invalid:border-monti-danger aria-invalid:ring-3 aria-invalid:ring-monti-danger/20 aria-invalid:aria-checked:border-monti-contrast data-checked:border-monti-contrast data-checked:bg-monti-emphasis monti-dark:data-checked:bg-monti-emphasis data-checked:text-monti-on-emphasis group-has-[:focus-visible]/field-label:data-checked:border-monti-contrast",
				className,
			)}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				data-slot="checkbox-indicator"
				className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
			>
				<CheckIcon />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
}

export { Checkbox };
