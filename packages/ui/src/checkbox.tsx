"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { cn } from "./cn";
import { useProposalDescription } from "./proposal-cue";

/**
 * A checkbox: 14px, a ✓ when on and a bar when only some are on (`indeterminate`, the select-all of a list with part of it picked). The mark
 * is drawn, so the state never rests on color alone. `proposal` marks a choice the assistant made and nobody has touched: the same mark in blue.
 */
function Checkbox({
	className,
	proposal = false,
	...props
}: CheckboxPrimitive.Root.Props & {
	/** The assistant made this choice and nobody has touched it yet. Turn it off when it is changed. */
	proposal?: boolean;
}) {
	return (
		<CheckboxPrimitive.Root
			data-slot="checkbox"
			data-proposal={proposal || undefined}
			aria-description={useProposalDescription(proposal)}
			className={cn(
				"group/check peer data-checked:data-proposal:border-(color:--monti-fg-proposal) data-indeterminate:data-proposal:border-(color:--monti-fg-proposal) relative flex size-3.5 shrink-0 items-center justify-center rounded-monti-sm border-[1.5px] border-monti-faint bg-transparent outline-none transition-colors after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-3 focus-visible:ring-monti-contrast/20 disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-monti-danger data-checked:data-proposal:bg-(--monti-fg-proposal) data-indeterminate:data-proposal:bg-(--monti-fg-proposal) data-checked:border-monti-contrast data-indeterminate:border-monti-contrast data-checked:bg-monti-emphasis data-indeterminate:bg-monti-emphasis",
				className,
			)}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				data-slot="checkbox-indicator"
				className="flex text-monti-on-emphasis"
				render={(indicatorProps) => (
					<span {...indicatorProps}>
						<svg
							viewBox="0 0 14 14"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							className="size-3.5"
							aria-hidden="true"
						>
							<path className="group-data-indeterminate/check:hidden" d="M2.3 6.9 5.1 9.7 10.7 4.1" />
							<path className="hidden group-data-indeterminate/check:block" d="M4 7h6" />
						</svg>
					</span>
				)}
			/>
		</CheckboxPrimitive.Root>
	);
}

export { Checkbox };
