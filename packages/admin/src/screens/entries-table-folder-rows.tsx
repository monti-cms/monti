// Folder rows shown above the entries in folder browse mode: the move-to-parent row and subfolder rows.

import { Folder as FolderIcon, FolderOpen, FolderParent } from "@carbon/icons-react";
import type { Folder } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { RowActions, TableCell, TableRow, Text, TextButton } from "@monti-cms/ui";
import { commonMessages } from "../lib/common.messages";
import { folderKeyHandler } from "./admin-sidebar";
import { ROW_ENDS } from "./entries-table-row";
import { screensMessages } from "./messages";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "./shared/action-menu";
import { type FolderActions, folderMenuActions } from "./shared/use-folder-actions";

export function EntriesTableFolderRows({
	explorer,
	folders,
	folderActions,
	cellSizes,
	visibleCount,
	onSelectFolder,
}: {
	explorer: { folders: Folder[]; parent: string | null };
	folders: Folder[];
	folderActions?: FolderActions;
	/** The widths of the cells between the folder's name and its ⋯, which stay empty: the rows of the table keep the same columns. */
	cellSizes?: readonly number[];
	/** For a table whose rows are not laid out by `cellSizes` (the media table): the number of cells in a row, counted including empty ones. */
	visibleCount?: number;
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
			{cellSizes === undefined ? (
				<>
					{explorer.parent !== null && (
						<TableRow>
							<TableCell align="center" tone="muted">
								<FolderParent aria-hidden size={16} />
							</TableCell>
							<TableCell colSpan={(visibleCount ?? 3) - 1}>
								<TextButton
									variant="quiet"
									render={<button type="button" onClick={() => onSelectFolder(explorer.parent ?? "all")} />}
								>
									{t("list.folderUp")}
								</TextButton>
							</TableCell>
						</TableRow>
					)}
					{explorer.folders.map((folder) => (
						<ActionContextMenu key={`folder-${folder.id}`} actions={folderRowMenu(folder)} trigger={<TableRow />}>
							<TableCell align="center" tone="muted">
								<FolderIcon aria-hidden size={16} />
							</TableCell>
							<TableCell colSpan={(visibleCount ?? 3) - 2}>
								<Text weight="medium">
									<TextButton
										render={
											<button
												type="button"
												onClick={() => onSelectFolder(folder.id)}
												onKeyDown={folderActions ? folderKeyHandler(folder, folderActions) : undefined}
											/>
										}
									>
										{folder.name}
									</TextButton>
								</Text>
							</TableCell>
							<TableCell align="end">
								<MoreActionsButton
									actions={folderRowMenu(folder)}
									label={t("list.folderActions", { name: folder.name })}
								/>
							</TableCell>
						</ActionContextMenu>
					))}
				</>
			) : (
				<>
					{explorer.parent !== null && (
						<TableRow>
							<TableCell size={ROW_ENDS.start} align="center" tone="muted">
								<FolderParent aria-hidden size={16} />
							</TableCell>
							<TableCell>
								<TextButton
									variant="quiet"
									render={<button type="button" onClick={() => onSelectFolder(explorer.parent ?? "all")} />}
								>
									{t("list.folderUp")}
								</TextButton>
							</TableCell>
							{cellSizes.map((size, index) => (
								<TableCell key={`${index}-${size}`} size={size} />
							))}
							<TableCell size={ROW_ENDS.end} />
						</TableRow>
					)}
					{explorer.folders.map((folder) => (
						<ActionContextMenu key={`folder-${folder.id}`} actions={folderRowMenu(folder)} trigger={<TableRow />}>
							<TableCell size={ROW_ENDS.start} align="center" tone="muted">
								<FolderIcon aria-hidden size={16} />
							</TableCell>
							<TableCell>
								<TextButton
									render={
										<button
											type="button"
											onClick={() => onSelectFolder(folder.id)}
											onKeyDown={folderActions ? folderKeyHandler(folder, folderActions) : undefined}
										/>
									}
								>
									{folder.name}
								</TextButton>
							</TableCell>
							{cellSizes.map((size, index) => (
								<TableCell key={`${index}-${size}`} size={size} />
							))}
							<TableCell size={ROW_ENDS.end} align="end">
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
			)}
		</>
	);
}
