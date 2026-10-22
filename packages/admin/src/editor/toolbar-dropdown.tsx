/** The dropdown button used by the toolbar for grouped tools (block shape, alignment, lists, ...). */

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, IconButton } from "@monti-cms/ui";
import type { Editor } from "@tiptap/core";
import { ChevronDown, type LucideIcon } from "lucide-react";
import type { ToolbarItem } from "./toolbar-button";
import { ToolbarMenuItem } from "./toolbar-row";

export function ToolbarDropdown({
	editor,
	label,
	items,
	icon: Icon,
	iconOnly = false,
}: {
	editor: Editor;
	label: string;
	items: ToolbarItem[];
	icon?: LucideIcon;
	/** Shows only the icon, no text. The name is conveyed via aria-label and tooltip. */
	iconOnly?: boolean;
}) {
	const content = (
		<>
			{Icon && <Icon aria-hidden className="size-4" />}
			{!iconOnly && label}
			<ChevronDown aria-hidden className="size-3" />
		</>
	);
	return (
		<DropdownMenu>
			{iconOnly ? (
				<IconButton
					label={label}
					side="bottom"
					size="sm"
					className="h-8 gap-tight px-condensed text-monti-caption"
					disabled={!editor.isEditable}
					onMouseDown={(event) => event.preventDefault()}
					trigger={(button) => <DropdownMenuTrigger render={button} />}
				>
					{content}
				</IconButton>
			) : (
				<DropdownMenuTrigger
					render={
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-8 gap-tight px-condensed text-monti-caption"
							aria-label={label}
							disabled={!editor.isEditable}
							onMouseDown={(event) => event.preventDefault()}
						/>
					}
				>
					{content}
				</DropdownMenuTrigger>
			)}
			<DropdownMenuContent align="start" className="min-w-36">
				{items.map((item) => (
					<ToolbarMenuItem key={item.label} editor={editor} item={item} />
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
