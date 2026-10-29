// Folder rows shown above the entries in folder browse mode: the move-to-parent row, the row of a folder being made, and subfolder rows. A row has no
// status: its folder icon starts the title's cell, then the name and, faint, how many things are directly inside. A folder being made or renamed has its
// name as a field in the same place (no dialog).

import { Folder as FolderIcon, FolderOpen, FolderParent } from "@carbon/icons-react";
import type { Folder } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { Inline, RowActions, RowLink, RowThumb, TableCell, TableRow, Text } from "@monti-cms/ui";
import { type ReactNode, useEffect, useRef } from "react";
import { commonMessages } from "../lib/common.messages";
import { ACTIONS_SIZE } from "./entries-table-widths";
import { screensMessages } from "./messages";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "./shared/action-menu";
import { FolderNameField } from "./shared/folder-name-field";
import { type FolderActions, folderKeyHandler, folderMenuActions } from "./shared/use-folder-actions";

/**
 * The cells a folder row spends on its icon and its name, after the empty `before` columns. Inline, one cell holds both; with the icon in its own
 * column (where a file's thumbnail is) the name starts in the cell after it, in line with the file names.
 */
function FolderCells({
	layout,
	span,
	icon,
	children,
}: {
	layout: "inline" | "thumb";
	span: number;
	icon: ReactNode;
	children: ReactNode;
}) {
	if (layout === "thumb") {
		return (
			<>
				<TableCell>
					<RowThumb>{icon}</RowThumb>
				</TableCell>
				<TableCell colSpan={span - 1}>{children}</TableCell>
			</>
		);
	}
	return (
		<TableCell colSpan={span}>
			<Inline gap={8}>
				{icon}
				{children}
			</Inline>
		</TableCell>
	);
}

export function EntriesTableFolderRows({
	explorer,
	folders,
	folderActions,
	span,
	before = [],
	countLabel,
	onSelectFolder,
	layout = "inline",
}: {
	explorer: { folders: (Folder & { entryCount?: number })[]; parent: string | null };
	folders: Folder[];
	folderActions?: FolderActions;
	/**
	 * `inline`: the icon and the name share one cell, with a ⋯ at the end of a folder (the posts list). `thumb`: the icon sits in the first column, where
	 * a file's thumbnail is, and the name in the cell after it, and a folder has no ⋯ (its menu is the right click; the media list).
	 */
	layout?: "inline" | "thumb";
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
					<FolderCells layout={layout} span={span - before.length} icon={<FolderParent aria-hidden size={16} />}>
						<RowLink render={<button type="button" onClick={() => onSelectFolder(explorer.parent ?? "all")} />}>
							{t("list.folderUp")}
						</RowLink>
					</FolderCells>
					<TableCell size={ACTIONS_SIZE} />
				</TableRow>
			)}
			{folderActions && making && (
				<TableRow selected>
					{empty}
					<FolderCells layout={layout} span={span - before.length} icon={<FolderIcon aria-hidden size={16} />}>
						<FolderNameField naming={making} actions={folderActions} />
					</FolderCells>
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
					layout={layout}
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
	layout,
	countLabel,
	onSelectFolder,
}: {
	folder: Folder & { entryCount?: number };
	folders: Folder[];
	folderActions?: FolderActions;
	span: number;
	before: readonly string[];
	layout: "inline" | "thumb";
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
			<FolderCells layout={layout} span={span - before.length} icon={<FolderIcon aria-hidden size={16} />}>
				<Inline gap={layout === "thumb" ? 12 : 8}>
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
			</FolderCells>
			<TableCell size={ACTIONS_SIZE} align="end">
				{layout === "inline" && (
					<RowActions>
						<MoreActionsButton actions={menu} label={t("list.folderActions", { name: folder.name })} />
					</RowActions>
				)}
			</TableCell>
		</ActionContextMenu>
	);
}
