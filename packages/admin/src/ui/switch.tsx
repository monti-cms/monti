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
				"peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs outline-none transition-all after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-cms-ring focus-visible:ring-3 focus-visible:ring-cms-ring/50 group-has-[:focus-visible]/field-label:border-transparent group-has-[:focus-visible]/field-label:ring-0 aria-invalid:border-cms-destructive cms-dark:aria-invalid:border-cms-destructive/50 aria-invalid:ring-3 aria-invalid:ring-cms-destructive/20 cms-dark:aria-invalid:ring-cms-destructive/40 data-[size=default]:h-[18.4px] data-[size=sm]:h-[14px] data-[size=default]:w-[32px] data-[size=sm]:w-[24px] data-disabled:cursor-not-allowed cms-dark:data-unchecked:bg-cms-input/80 data-checked:bg-cms-primary data-unchecked:bg-cms-input data-disabled:opacity-50",
				className,
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className="pointer-events-none block rounded-full bg-cms-background ring-0 transition-transform cms-dark:data-checked:bg-cms-primary-foreground cms-dark:data-unchecked:bg-cms-foreground group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-unchecked:translate-x-0"
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
