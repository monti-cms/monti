"use client";

import { AppConnectivity } from "@carbon/icons-react";
import { type Site, useSite, useTranslator } from "@monti-cms/core/site";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	IconButton,
	Stack,
	Text,
} from "@monti-cms/ui";
import type { Editor } from "@tiptap/core";
import { useMemo } from "react";
import { useIconByName } from "../screens/shared/collection-icon";
import { allowanceOfState } from "./allowed-extension";
import { editorMessages } from "./messages";
import { buildBlockSlashCommands, isOffered } from "./slash-command";

/** The components the body's allowed list lets a writer insert (all of them when it has no list). */
export const offeredBlocks = (site: Site, editor: Editor) => {
	const allowance = allowanceOfState(editor.state);
	return buildBlockSlashCommands(site).filter((item) => isOffered(item, allowance));
};

/** Custom component list. Shared by the component menu and the toolbar "More" menu. Like the slash menu, it shows a description under each name. */
export function CustomBlockMenuItems({ editor }: { editor: Editor }) {
	const site = useSite();
	const iconByName = useIconByName();
	const customBlocks = useMemo(() => offeredBlocks(site, editor), [site, editor]);
	return customBlocks.map((block) => {
		// The block definition's icon (`editor.icon`). Falls back to a puzzle icon.
		const Icon = (typeof block.icon === "string" ? iconByName(block.icon) : block.icon) ?? AppConnectivity;
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
				<Icon aria-hidden />
				<Stack as="span" gap={0} minWidth={0} grow>
					<Text truncate>{block.title}</Text>
					<Text variant="caption" tone="muted" truncate>
						{block.description}
					</Text>
				</Stack>
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
				<AppConnectivity aria-hidden />
			</IconButton>
			<DropdownMenuContent align="start">
				<CustomBlockMenuItems editor={editor} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
