"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "../lib/utils";

function Switch({
	className,
	size = "default",
	...props
}: SwitchPrimitive.Root.Props & {
	size?: "sm" | "default";
}) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			data-size={size}
			className={cn(
				"peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent outline-none transition-all after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-monti-ring focus-visible:ring-3 focus-visible:ring-monti-ring/50 group-has-[:focus-visible]/field-label:border-transparent group-has-[:focus-visible]/field-label:ring-0 aria-invalid:border-monti-destructive monti-dark:aria-invalid:border-monti-destructive/50 aria-invalid:ring-3 aria-invalid:ring-monti-destructive/20 monti-dark:aria-invalid:ring-monti-destructive/40 data-[size=default]:h-[18.4px] data-[size=sm]:h-[14px] data-[size=default]:w-[32px] data-[size=sm]:w-[24px] data-disabled:cursor-not-allowed data-checked:bg-monti-highlight data-unchecked:bg-monti-input monti-dark:data-unchecked:bg-monti-input/80 data-disabled:opacity-50",
				className,
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className="pointer-events-none block rounded-full bg-monti-background ring-0 transition-transform monti-dark:data-checked:bg-monti-primary-foreground monti-dark:data-unchecked:bg-monti-foreground group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-unchecked:translate-x-0"
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
