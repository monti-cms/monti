"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "./cn";
import { useProposalDescription } from "./proposal-cue";

/**
 * An on/off setting that takes effect at once. 34 by 20: the knob sits left when off and right when on. `proposal` marks a setting the assistant
 * turned on and nobody has touched: the track is blue.
 */
function Switch({
	className,
	proposal = false,
	...props
}: SwitchPrimitive.Root.Props & {
	/** The assistant turned this on and nobody has touched it yet. Turn it off when it is changed. */
	proposal?: boolean;
}) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			data-proposal={proposal || undefined}
			aria-description={useProposalDescription(proposal)}
			className={cn(
				"peer group/switch relative inline-flex h-5 w-[34px] shrink-0 items-center rounded-monti-full bg-(--monti-border-default) outline-none transition-colors after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-3 focus-visible:ring-monti-contrast/20 aria-invalid:ring-2 aria-invalid:ring-monti-danger data-checked:data-proposal:bg-(--monti-fg-proposal) data-disabled:cursor-not-allowed data-checked:bg-monti-emphasis data-disabled:opacity-45",
				className,
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className="pointer-events-none block size-4 translate-x-[2px] rounded-monti-full bg-monti-page transition-transform data-checked:translate-x-[16px] data-checked:bg-(--monti-fg-on-emphasis)"
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
