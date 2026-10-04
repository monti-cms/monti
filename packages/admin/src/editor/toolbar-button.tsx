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

/** 서식 도구·표 도구의 아이콘 버튼. 누를 때 편집기 선택을 빼앗지 않는다. */
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
		// 버튼 클릭이 편집기 선택을 빼앗지 않게 한다.
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
