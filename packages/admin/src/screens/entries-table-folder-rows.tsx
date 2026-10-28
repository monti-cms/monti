// Folder rows shown above the entries in folder browse mode: the move-to-parent row, the row of a folder being made, and subfolder rows. A row has no
// status: its folder icon starts the title's cell, then the name and, faint, how many things are directly inside. A folder being made or renamed has its
// name as a field in the same place (no dialog).

import { Folder as FolderIcon, FolderOpen, FolderParent } from "@carbon/icons-react";
import type { Folder } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { Inline, RowActions, RowLink, TableCell, TableRow, Text } from "@monti-cms/ui";
import { useEffect, useRef } from "react";
import { commonMessages } from "../lib/common.messages";
import { ACTIONS_SIZE } from "./entries-table-widths";
import { screensMessages } from "./messages";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "./shared/action-menu";
import { FolderNameField } from "./shared/folder-name-field";
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
	const t = useTranslator(screensMessages);
	const empty = before.map((column) => <TableCell key={column} />);
	const naming = folderActions?.naming ?? null;
	const making = folderActions && naming?.mode === "create" ? naming : null;
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
			{folderActions && making && (
				<TableRow selected>
					{empty}
					<TableCell colSpan={span - before.length}>
						<Inline gap={8}>
							<FolderIcon aria-hidden size={16} />
							<FolderNameField naming={making} actions={folderActions} />
						</Inline>
					</TableCell>
					<TableCell size={ACTIONS_SIZE} />
				</TableRow>
			)}
			{explorer.folders.map((folder) => (
				<EntriesTableFolderRow
					key={`folder-${folder.id}`}
					folder={folder}
					folders={folders}
					folderActions={folderActions}
					span={span}
					before={before}
					countLabel={countLabel}
					onSelectFolder={onSelectFolder}
				/>
			))}
		</>
	);
}

function EntriesTableFolderRow({
	folder,
	folders,
	folderActions,
	span,
	before,
	countLabel,
	onSelectFolder,
}: {
	folder: Folder & { entryCount?: number };
	folders: Folder[];
	folderActions?: FolderActions;
	span: number;
	before: readonly string[];
	countLabel?: (count: number) => string;
	onSelectFolder: (folder: string) => void;
}) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const tc = useTranslator(commonMessages);
	const link = useRef<HTMLButtonElement>(null);
	const naming = folderActions?.naming ?? null;
	const renaming = naming?.mode === "rename" && naming.folder.id === folder.id ? naming : null;
	// The folder that was just made or renamed takes focus once its name is a link again.
	const wantsFocus = folderActions?.focusFolderId === folder.id && !renaming;
	const focusSettled = folderActions?.focusSettled;
	useEffect(() => {
		if (!wantsFocus) return;
		link.current?.focus();
		focusSettled?.();
	}, [wantsFocus, focusSettled]);

	// Add "Open" to the same folder menu as the sidebar tree.
	const menu: MenuAction[] = folderActions
		? [
				{ kind: "item", label: tc("open"), icon: FolderOpen, onSelect: () => onSelectFolder(folder.id) },
				{ kind: "separator" },
				...folderMenuActions(site, folder, folders, folderActions),
			]
		: [];
	return (
		<ActionContextMenu actions={menu} trigger={<TableRow />}>
			{before.map((column) => (
				<TableCell key={column} />
			))}
			<TableCell colSpan={span - before.length}>
				<Inline gap={8}>
					<FolderIcon aria-hidden size={16} />
					{folderActions && renaming ? (
						<FolderNameField naming={renaming} actions={folderActions} />
					) : (
						<>
							<RowLink
								render={
									<button
										ref={link}
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
						</>
					)}
				</Inline>
			</TableCell>
			<TableCell size={ACTIONS_SIZE} align="end">
				<RowActions>
					<MoreActionsButton actions={menu} label={t("list.folderActions", { name: folder.name })} />
				</RowActions>
			</TableCell>
		</ActionContextMenu>
	);
}
