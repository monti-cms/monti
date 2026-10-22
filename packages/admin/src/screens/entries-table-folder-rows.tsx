// Folder rows shown above the entries in folder browse mode: the move-to-parent row and subfolder rows.

import type { Folder } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { Folder as FolderIcon, FolderOpen, FolderUp } from "lucide-react";
import { commonMessages } from "../lib/common.messages";
import { Button } from "../ui/button";
import { TableCell, TableRow } from "../ui/table";
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
					<TableCell className="text-center text-monti-muted">
						<FolderUp aria-hidden className="mx-auto size-4" />
					</TableCell>
					<TableCell colSpan={visibleCount - 1}>
						<Button
							type="button"
							variant="link"
							size="sm"
							onClick={() => onSelectFolder(explorer.parent ?? "all")}
							className="h-auto p-0 text-monti-muted hover:text-monti-default"
						>
							{t("list.folderUp")}
						</Button>
					</TableCell>
				</TableRow>
			)}
			{explorer.folders.map((folder) => (
				<ActionContextMenu key={`folder-${folder.id}`} actions={folderRowMenu(folder)} trigger={<TableRow />}>
					<TableCell className="text-center text-monti-muted">
						<FolderIcon aria-hidden className="mx-auto size-4" />
					</TableCell>
					<TableCell colSpan={visibleCount - 2} className="font-medium">
						<Button
							type="button"
							variant="link"
							size="sm"
							onClick={() => onSelectFolder(folder.id)}
							onKeyDown={folderActions ? folderKeyHandler(folder, folderActions) : undefined}
							className="h-auto p-0 font-medium text-monti-default"
						>
							{folder.name}
						</Button>
					</TableCell>
					<TableCell className="text-right">
						<MoreActionsButton actions={folderRowMenu(folder)} label={t("list.folderActions", { name: folder.name })} />
					</TableCell>
				</ActionContextMenu>
			))}
		</>
	);
}
