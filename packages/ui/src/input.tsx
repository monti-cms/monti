import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";
import { cn } from "./cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<InputPrimitive
			type={type}
			data-slot="input"
			className={cn(
				"h-9 w-full min-w-0 rounded-md border border-monti-default bg-transparent px-2.5 py-1 text-monti-reading outline-none transition-[color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-monti-body file:text-monti-default placeholder:text-monti-muted focus-visible:border-monti-focus focus-visible:ring-3 focus-visible:ring-monti-focus-soft disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-monti-danger monti-dark:aria-invalid:border-monti-danger-muted aria-invalid:ring-3 aria-invalid:ring-monti-danger monti-dark:aria-invalid:ring-monti-danger md:text-monti-body",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
