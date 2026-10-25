"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "./cn";

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
				"peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-monti-default shadow-monti-control outline-none transition-all after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-monti-focus focus-visible:ring-3 focus-visible:ring-monti-focus-soft group-has-[:focus-visible]/field-label:border-transparent group-has-[:focus-visible]/field-label:ring-0 aria-invalid:border-monti-danger aria-invalid:ring-3 aria-invalid:ring-monti-danger-soft data-[size=default]:h-5 data-[size=sm]:h-4 data-[size=default]:w-9 data-[size=sm]:w-7 data-disabled:cursor-not-allowed data-checked:border-transparent data-checked:bg-monti-accent-emphasis data-unchecked:bg-monti-active monti-dark:data-unchecked:bg-monti-active data-disabled:opacity-50",
				className,
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className="pointer-events-none block rounded-full bg-monti-surface shadow-monti-btn ring-0 transition-transform monti-dark:data-checked:bg-monti-page monti-dark:data-unchecked:bg-monti-emphasis group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-4 group-data-[size=default]/switch:data-unchecked:translate-x-0.5 group-data-[size=sm]/switch:data-checked:translate-x-3 group-data-[size=sm]/switch:data-unchecked:translate-x-0.5"
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
