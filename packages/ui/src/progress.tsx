"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "./cn";

/** How far a long step is: a bar that fills to `value` (0–100), or moves on its own while the amount is unknown (`value` null). */
function Progress({ value, label, className }: { value: number | null; label: string; className?: string }) {
	return (
		<ProgressPrimitive.Root value={value} aria-label={label} data-slot="progress" className={cn("w-full", className)}>
			<ProgressPrimitive.Track className="relative h-1 w-full overflow-hidden rounded-full bg-monti-neutral">
				<ProgressPrimitive.Indicator
					className={cn(
						"h-full rounded-full bg-monti-accent-emphasis transition-[width] duration-300",
						value === null && "absolute w-1/3 animate-monti-progress",
					)}
				/>
			</ProgressPrimitive.Track>
		</ProgressPrimitive.Root>
	);
}

export { Progress };
