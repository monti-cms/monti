// Folder rows shown above the entries in folder browse mode: the move-to-parent row and subfolder rows. A row has no status: its folder icon starts the
// title's cell, then the name and, faint, how many things are directly inside.

import { Folder as FolderIcon, FolderOpen, FolderParent } from "@carbon/icons-react";
import type { Folder } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { Inline, RowActions, RowLink, TableCell, TableRow, Text } from "@monti-cms/ui";
import { commonMessages } from "../lib/common.messages";
import { ACTIONS_SIZE } from "./entries-table-widths";
import { screensMessages } from "./messages";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "./shared/action-menu";
import { type FolderActions, folderKeyHandler, folderMenuActions } from "./shared/use-folder-actions";

export function EntriesTableFolderRows({
	explorer,
	folders,
	folderActions,
	span,
	before = [],
	countLabel,
	onSelectFolder,
}: {
	explorer: { folders: (Folder & { entryCount?: number })[]; parent: string | null };
	folders: Folder[];
	folderActions?: FolderActions;
	/** How many columns the rows have before their ⋯. */
	span: number;
	/** The columns that come before the title and stay empty (the status): the folder's icon and name start the cell after them and take the rest. */
	before?: readonly string[];
	/** What follows a folder's name: how many things are directly in it ("Post 2"). */
	countLabel?: (count: number) => string;
	onSelectFolder: (folder: string) => void;
}) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const tc = useTranslator(commonMessages);

	// Add "Open" to the same folder menu as the sidebar tree.
	const folderRowMenu = (folder: Folder): MenuAction[] =>
		folderActions
			? [
					{ kind: "item", label: tc("open"), icon: FolderOpen, onSelect: () => onSelectFolder(folder.id) },
					{ kind: "separator" },
					...folderMenuActions(site, folder, folders, folderActions),
				]
			: [];

	const empty = before.map((column) => <TableCell key={column} />);
	return (
		<>
			{explorer.parent !== null && (
				<TableRow>
					{empty}
					<TableCell colSpan={span - before.length}>
						<Inline gap={8}>
							<FolderParent aria-hidden size={16} />
							<RowLink render={<button type="button" onClick={() => onSelectFolder(explorer.parent ?? "all")} />}>
								{t("list.folderUp")}
							</RowLink>
						</Inline>
					</TableCell>
					<TableCell size={ACTIONS_SIZE} />
				</TableRow>
			)}
			{explorer.folders.map((folder) => (
				<ActionContextMenu key={`folder-${folder.id}`} actions={folderRowMenu(folder)} trigger={<TableRow />}>
					{empty}
					<TableCell colSpan={span - before.length}>
						<Inline gap={8}>
							<FolderIcon aria-hidden size={16} />
							<RowLink
								render={
									<button
										type="button"
										onClick={() => onSelectFolder(folder.id)}
										onKeyDown={folderActions ? folderKeyHandler(folder, folderActions) : undefined}
									/>
								}
							>
								{folder.name}
							</RowLink>
							{countLabel && folder.entryCount !== undefined && (
								<Text as="span" mono variant="meta" tone="faint">
									{countLabel(folder.entryCount)}
								</Text>
							)}
						</Inline>
					</TableCell>
					<TableCell size={ACTIONS_SIZE} align="end">
						<RowActions>
							<MoreActionsButton
								actions={folderRowMenu(folder)}
								label={t("list.folderActions", { name: folder.name })}
							/>
						</RowActions>
					</TableCell>
				</ActionContextMenu>
			))}
		</>
	);
}
