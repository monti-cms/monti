"use client";

// Small pieces of the entry editor's toolbar: toggles.

import { Button, IconButton } from "@monti-cms/ui";
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
	if (text) {
		return (
			<Button
				size="sm"
				variant={pressed ? "primary" : "secondary"}
				aria-pressed={pressed}
				disabled={disabled}
				onClick={() => onPressedChange(!pressed)}
			>
				<Icon aria-hidden />
				{text}
			</Button>
		);
	}
	return (
		<IconButton
			label={label}
			side="bottom"
			pressed={pressed}
			disabled={disabled}
			onClick={() => onPressedChange(!pressed)}
		>
			<Icon aria-hidden />
		</IconButton>
	);
}
