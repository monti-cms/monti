import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";
import { cn } from "../lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<InputPrimitive
			type={type}
			data-slot="input"
			className={cn(
				"h-9 w-full min-w-0 rounded-md border border-monti-input bg-transparent monti-dark:bg-monti-input/30 px-2.5 py-1 text-base outline-none transition-[color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-monti-foreground file:text-sm placeholder:text-monti-muted-foreground focus-visible:border-monti-ring focus-visible:ring-3 focus-visible:ring-monti-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-monti-destructive monti-dark:aria-invalid:border-monti-destructive/50 aria-invalid:ring-3 aria-invalid:ring-monti-destructive/20 monti-dark:aria-invalid:ring-monti-destructive/40 md:text-sm",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
