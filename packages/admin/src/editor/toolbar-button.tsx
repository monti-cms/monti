"use client";

import type { MontiIcon } from "@monti-cms/ui";
import { IconButton } from "@monti-cms/ui";
import type { Editor } from "@tiptap/core";

export interface ToolbarItem {
	label: string;
	title?: string;
	icon: MontiIcon;
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
	return (
		<IconButton
			label={label}
			side={tooltipSide}
			tone={item.tone}
			pressed={item.isActive ? active : undefined}
			disabled={disabled}
			// Keep the button click from stealing the editor selection.
			onMouseDown={(event) => event.preventDefault()}
			onClick={() => item.run(editor)}
		>
			<Icon aria-hidden />
		</IconButton>
	);
}
