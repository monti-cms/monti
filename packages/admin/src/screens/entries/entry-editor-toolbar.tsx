"use client";

// Small pieces of the entry editor's toolbar: toggles.

import { IconButton } from "@monti-cms/ui";
import type { LucideIcon } from "lucide-react";

/** Toggle at the end of the editor toolbar (source pane, MDX source): an icon button that keeps its background while on. The name is the tooltip. */
export function ToolbarToggle({
	label,
	icon: Icon,
	pressed,
	disabled,
	onPressedChange,
}: {
	label: string;
	icon: LucideIcon;
	pressed: boolean;
	disabled?: boolean;
	onPressedChange: (pressed: boolean) => void;
}) {
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
