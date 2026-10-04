import type * as React from "react";
import { cn } from "../lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"field-sizing-content flex min-h-16 w-full rounded-md border border-cms-input bg-transparent cms-dark:bg-cms-input/30 px-2.5 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-cms-muted-foreground focus-visible:border-cms-ring focus-visible:ring-3 focus-visible:ring-cms-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-cms-destructive cms-dark:aria-invalid:border-cms-destructive/50 aria-invalid:ring-3 aria-invalid:ring-cms-destructive/20 cms-dark:aria-invalid:ring-cms-destructive/40 md:text-sm",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
