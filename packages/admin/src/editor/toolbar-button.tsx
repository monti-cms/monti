"use client";

import { Button, Toggle, Tooltip, TooltipContent, TooltipTrigger } from "@monti-cms/ui";
import type { Editor } from "@tiptap/core";
import type { LucideIcon } from "lucide-react";
import type React from "react";

export interface ToolbarItem {
	label: string;
	title?: string;
	icon: LucideIcon;
	/** `danger` for a tool that removes something. */
	tone?: "danger";
	isActive?: (editor: Editor) => boolean;
	isDisabled?: (editor: Editor) => boolean;
	run: (editor: Editor) => void;
}

/** Icon button for formatting tools and table tools. Does not steal the editor selection when pressed. */
export function ToolbarButton({
	editor,
	item,
	tooltipSide = "bottom",
}: {
	editor: Editor;
	item: ToolbarItem;
	tooltipSide?: "top" | "bottom";
}) {
	const active = item.isActive?.(editor) ?? false;
	const disabled = !editor.isEditable || (item.isDisabled?.(editor) ?? false);
	const label = item.title ?? item.label;
	const Icon = item.icon;
	const common = {
		"aria-label": label,
		disabled,
		// Keep the button click from stealing the editor selection.
		onMouseDown: (event: React.MouseEvent) => event.preventDefault(),
	};
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					item.isActive ? (
						<Toggle size="sm" pressed={active} onPressedChange={() => item.run(editor)} {...common} />
					) : (
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							tone={item.tone}
							onClick={() => item.run(editor)}
							{...common}
						/>
					)
				}
			>
				<Icon aria-hidden />
			</TooltipTrigger>
			<TooltipContent side={tooltipSide}>{label}</TooltipContent>
		</Tooltip>
	);
}
