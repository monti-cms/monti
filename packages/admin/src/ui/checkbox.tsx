"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon } from "lucide-react";
import { cn } from "../lib/utils";

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
	return (
		<CheckboxPrimitive.Root
			data-slot="checkbox"
			className={cn(
				"peer relative flex size-4 shrink-0 items-center justify-center rounded-md border border-monti-input monti-dark:bg-monti-input/30 outline-none transition-shadow after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-monti-ring focus-visible:ring-3 focus-visible:ring-monti-ring/50 disabled:cursor-not-allowed disabled:opacity-50 group-has-[:focus-visible]/field-label:not-data-checked:border-monti-input group-has-disabled/field:opacity-50 group-has-[:focus-visible]/field-label:ring-0 aria-invalid:border-monti-destructive monti-dark:aria-invalid:border-monti-destructive/50 aria-invalid:ring-3 aria-invalid:ring-monti-destructive/20 monti-dark:aria-invalid:ring-monti-destructive/40 aria-invalid:aria-checked:border-monti-highlight data-checked:border-monti-highlight data-checked:bg-monti-highlight monti-dark:data-checked:bg-monti-highlight data-checked:text-monti-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-monti-highlight",
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
