import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";
import { cn } from "./cn";
import { CONTROL_SIZE, type ControlSize } from "./control";

function Input({
	className,
	type,
	size = "default",
	mono = false,
	...props
}: Omit<React.ComponentProps<"input">, "size"> & {
	/** `sm` (32px) beside small buttons in toolbars, filters and tables; `default` (36px) in forms. */
	size?: ControlSize;
	/** Fixed-width letters for slugs, paths, keys and code. */
	mono?: boolean;
}) {
	return (
		<InputPrimitive
			type={type}
			data-slot="input"
			data-size={size}
			className={cn(
				"w-full min-w-0 rounded-md border border-monti-default bg-transparent px-2.5 py-1 outline-none transition-[color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-monti-body file:text-monti-default placeholder:text-monti-muted focus-visible:border-monti-focus focus-visible:ring-3 focus-visible:ring-monti-focus-soft disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-monti-danger aria-invalid:ring-3 aria-invalid:ring-monti-danger-soft",
				CONTROL_SIZE[size],
				mono && "font-mono",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
