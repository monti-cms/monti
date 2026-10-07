"use client";

import { useSite, useTranslator } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import { Puzzle } from "lucide-react";
import { useMemo } from "react";
import { useIconByName } from "../screens/shared/collection-icon";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { IconButton } from "../ui/icon-button";
import { editorMessages } from "./messages";
import { buildBlockSlashCommands } from "./slash-command";

/** Custom component list. Shared by the component menu and the toolbar "More" menu. Like the slash menu, it shows a description under each name. */
export function CustomBlockMenuItems({ editor }: { editor: Editor }) {
	const site = useSite();
	const iconByName = useIconByName();
	const customBlocks = useMemo(() => buildBlockSlashCommands(site), [site]);
	return customBlocks.map((block) => {
		// The block definition's icon (`editor.icon`). Falls back to a puzzle icon.
		const Icon = (typeof block.icon === "string" ? iconByName(block.icon) : block.icon) ?? Puzzle;
		return (
			<DropdownMenuItem
				key={block.id ?? block.title}
				disabled={!editor.isEditable}
				// This is a slash menu action with no text to delete, so pass an empty range at the cursor.
				onClick={() => {
					const { from } = editor.state.selection;
					block.action(editor, { from, to: from });
				}}
			>
				<Icon aria-hidden className="size-4" />
				<span className="min-w-0 flex-1">
					<span className="block truncate">{block.title}</span>
					<span className="block truncate text-cms-muted-foreground text-xs">{block.description}</span>
				</span>
			</DropdownMenuItem>
		);
	});
}

/** Inserts a custom component (block) at the cursor from the toolbar. */
export function CustomBlockMenu({ editor }: { editor: Editor }) {
	const t = useTranslator(editorMessages);
	return (
		<DropdownMenu>
			<IconButton
				label={t("customBlockMenu.label")}
				side="bottom"
				disabled={!editor.isEditable}
				onMouseDown={(event) => event.preventDefault()}
				trigger={(button) => <DropdownMenuTrigger render={button} />}
			>
				<Puzzle className="size-4" aria-hidden />
			</IconButton>
			<DropdownMenuContent align="start" className="w-64">
				<CustomBlockMenuItems editor={editor} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
