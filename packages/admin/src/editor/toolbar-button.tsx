"use client";

import type { Editor } from "@tiptap/core";
import type { LucideIcon } from "lucide-react";
import type React from "react";
import { cn } from "../lib/utils/cn";
import { Button } from "../ui/button";
import { Toggle } from "../ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export interface ToolbarItem {
	label: string;
	title?: string;
	icon: LucideIcon;
	className?: string;
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
		className: cn("size-8 p-0 text-xs", item.className),
	};
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					item.isActive ? (
						<Toggle size="sm" pressed={active} onPressedChange={() => item.run(editor)} {...common} />
					) : (
						<Button type="button" variant="ghost" size="sm" onClick={() => item.run(editor)} {...common} />
					)
				}
			>
				<Icon className="size-4" aria-hidden />
			</TooltipTrigger>
			<TooltipContent side={tooltipSide}>{label}</TooltipContent>
		</Tooltip>
	);
}
