// Folder rows shown above the entries in folder browse mode: the move-to-parent row and subfolder rows.

import type { Folder } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { TableCell, TableRow, Text, TextLink } from "@monti-cms/ui";
import { Folder as FolderIcon, FolderOpen, FolderUp } from "lucide-react";
import { commonMessages } from "../lib/common.messages";
import { folderKeyHandler } from "./admin-sidebar";
import { screensMessages } from "./messages";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "./shared/action-menu";
import { type FolderActions, folderMenuActions } from "./shared/use-folder-actions";

export function EntriesTableFolderRows({
	explorer,
	folders,
	folderActions,
	visibleCount,
	onSelectFolder,
}: {
	explorer: { folders: Folder[]; parent: string | null };
	folders: Folder[];
	folderActions?: FolderActions;
	/** Number of cells in a row, counted including empty ones. */
	visibleCount: number;
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
					<TableCell align="center" tone="muted">
						<FolderUp aria-hidden size={16} />
					</TableCell>
					<TableCell colSpan={visibleCount - 1}>
						<TextLink
							underline="hover"
							tone="muted"
							render={<button type="button" onClick={() => onSelectFolder(explorer.parent ?? "all")} />}
						>
							{t("list.folderUp")}
						</TextLink>
					</TableCell>
				</TableRow>
			)}
			{explorer.folders.map((folder) => (
				<ActionContextMenu key={`folder-${folder.id}`} actions={folderRowMenu(folder)} trigger={<TableRow />}>
					<TableCell align="center" tone="muted">
						<FolderIcon aria-hidden size={16} />
					</TableCell>
					<TableCell colSpan={visibleCount - 2}>
						<Text weight="medium">
							<TextLink
								underline="hover"
								render={
									<button
										type="button"
										onClick={() => onSelectFolder(folder.id)}
										onKeyDown={folderActions ? folderKeyHandler(folder, folderActions) : undefined}
									/>
								}
							>
								{folder.name}
							</TextLink>
						</Text>
					</TableCell>
					<TableCell align="end">
						<MoreActionsButton actions={folderRowMenu(folder)} label={t("list.folderActions", { name: folder.name })} />
					</TableCell>
				</ActionContextMenu>
			))}
		</>
	);
}
