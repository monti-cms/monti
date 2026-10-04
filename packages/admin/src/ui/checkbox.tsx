"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon } from "lucide-react";
import { cn } from "../lib/utils";

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
	return (
		<CheckboxPrimitive.Root
			data-slot="checkbox"
			className={cn(
				"peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-cms-input cms-dark:bg-cms-input/30 shadow-xs outline-none transition-shadow after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-cms-ring focus-visible:ring-3 focus-visible:ring-cms-ring/50 disabled:cursor-not-allowed disabled:opacity-50 group-has-[:focus-visible]/field-label:not-data-checked:border-cms-input group-has-disabled/field:opacity-50 group-has-[:focus-visible]/field-label:ring-0 aria-invalid:border-cms-destructive cms-dark:aria-invalid:border-cms-destructive/50 aria-invalid:ring-3 aria-invalid:ring-cms-destructive/20 cms-dark:aria-invalid:ring-cms-destructive/40 aria-invalid:aria-checked:border-cms-primary data-checked:border-cms-primary cms-dark:data-checked:bg-cms-primary data-checked:bg-cms-primary data-checked:text-cms-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-cms-primary",
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
