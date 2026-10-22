"use client";

// Small pieces of the entry editor's toolbar: toggles.

import { Toggle, Tooltip, TooltipContent, TooltipTrigger } from "@monti-cms/ui";
import type { LucideIcon } from "lucide-react";

/** Toggle button at the end of the editor toolbar (source pane, MDX source). Name and tooltip are the same. */
export function ToolbarToggle({
	label,
	text,
	icon: Icon,
	pressed,
	disabled,
	onPressedChange,
}: {
	label: string;
	/** Text next to the icon. If absent, only the icon shows (the name is the tooltip). */
	text?: string;
	icon: LucideIcon;
	pressed: boolean;
	disabled?: boolean;
	onPressedChange: (pressed: boolean) => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Toggle
						size="sm"
						aria-label={label}
						pressed={pressed}
						disabled={disabled}
						onPressedChange={onPressedChange}
						className="gap-2 text-monti-muted aria-pressed:text-monti-default"
					/>
				}
			>
				<Icon aria-hidden className="size-4" />
				{text}
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}
