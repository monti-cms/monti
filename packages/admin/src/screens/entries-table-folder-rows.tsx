// Folder rows shown above the entries in folder browse mode: the move-to-parent row and subfolder rows.

import { Folder as FolderIcon, FolderOpen, FolderParent } from "@carbon/icons-react";
import type { Folder } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { Inline, RowActions, RowLink, TableCell, TableRow } from "@monti-cms/ui";
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
	onSelectFolder,
}: {
	explorer: { folders: Folder[]; parent: string | null };
	folders: Folder[];
	folderActions?: FolderActions;
	/** How many columns the rows have before their ⋯: a folder's icon and name take them all. */
	span: number;
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

	return (
		<>
			{explorer.parent !== null && (
				<TableRow>
					<TableCell colSpan={span}>
						<Inline gap={10}>
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
					<TableCell colSpan={span}>
						<Inline gap={10}>
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
