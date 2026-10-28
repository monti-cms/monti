"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "./cn";

/**
 * How far a long step is: a 3px bar that fills to `value` (0–100), on a `border-default` track, radius 2. A step whose length cannot be measured
 * (getting ready, finishing up) has no bar: it says so in words instead.
 */
function Progress({ value, label, className }: { value: number; label: string; className?: string }) {
	return (
		<ProgressPrimitive.Root value={value} aria-label={label} data-slot="progress" className={cn("w-full", className)}>
			<ProgressPrimitive.Track className="relative h-[3px] w-full overflow-hidden rounded-[2px] bg-(--monti-border-default)">
				<ProgressPrimitive.Indicator className="h-full bg-(--monti-fg-default) transition-[width] duration-300" />
			</ProgressPrimitive.Track>
		</ProgressPrimitive.Root>
	);
}

export { Progress };
