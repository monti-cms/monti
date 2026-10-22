import type * as React from "react";
import { cn } from "./cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"field-sizing-content flex min-h-16 w-full rounded-md border border-monti-default bg-transparent px-2.5 py-2 text-monti-reading outline-none transition-[color,box-shadow] placeholder:text-monti-muted focus-visible:border-monti-focus focus-visible:ring-3 focus-visible:ring-monti-focus-soft disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-monti-danger monti-dark:aria-invalid:border-monti-danger-muted aria-invalid:ring-3 aria-invalid:ring-monti-danger monti-dark:aria-invalid:ring-monti-danger md:text-monti-body",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
