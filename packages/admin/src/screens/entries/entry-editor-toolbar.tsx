"use client";

// Small pieces of the entry editor's toolbar: toggles.

import type { LucideIcon } from "lucide-react";
import { Toggle } from "../../ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";

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
						className="gap-1.5 text-monti-muted-foreground aria-pressed:text-monti-foreground"
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
