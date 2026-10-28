"use client";

import type { Folder, ListEntriesItem } from "@monti-cms/core/site";
import { type AdminColumnSettings, type PageSize, useSite, useTranslator } from "@monti-cms/core/site";
import { Box, Checkbox, Inline, Stack, Table, TableBody, TableCell, TableRow, Text, TextButton } from "@monti-cms/ui";
import { Fragment, type KeyboardEvent, type ReactNode } from "react";
import { useAdminComponents } from "../admin-components";
import { commonMessages } from "../lib/common.messages";
import { ColumnHeader } from "./column-header";
import { EntryCell, hasEntryCellValue } from "./entries-table-cells";
import { EntriesTableFolderRows } from "./entries-table-folder-rows";
import { type AdminListColumn, filterFor, isColumnFiltered } from "./list-columns";
import { clearFiltersPatch, isFiltered, type ListState } from "./list-state";
import { ListSubToolbar } from "./list-toolbar";
import { ListViewPopover } from "./list-view-popover";
import { screensMessages } from "./messages";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "./shared/action-menu";
import { EmptyState } from "./shared/empty-state";
import { writeDraggedEntries } from "./shared/entry-drag";
import { ListPagination } from "./shared/list-pager";
import { LoadErrorAlert } from "./shared/load-error-alert";
import type { FolderActions } from "./shared/use-folder-actions";
import type { TaxonomyOptions } from "./shared/use-taxonomy";
import { useEntriesTable } from "./use-entries-table";

const DATE_COLUMNS = new Set<AdminListColumn>(["updatedAt", "createdAt", "publishedAt"]);
const HEADER_COLUMNS = new Set<AdminListColumn>(["title", "status", "slug", "updatedAt", "createdAt", "publishedAt"]);

interface TableProps {
	collection: string;
	items: ListEntriesItem[];
	folders: Folder[];
	/** Subfolders and move-to-parent shown above the list in folder browse mode. */
	explorer: { folders: Folder[]; parent: string | null } | null;
	state: ListState;
	options: TaxonomyOptions;
	onStateChange: (patch: Partial<ListState>) => void;
	columnSettings?: AdminColumnSettings;
	onColumnSettingsChange: (settings: AdminColumnSettings) => void;
	selectedIds: Set<string>;
	onSelectionChange: (ids: Set<string>) => void;
	total: number;
	isLoading: boolean;
	/** Fetching a new list after conditions changed. Keeps the previous rows dimmed. */
	isRefreshing?: boolean;
	errorMessage: string | null;
	/** `trash` means the trash screen: no drag-move or folder browsing, and each row shows restore and permanent delete. */
	mode?: "list" | "trash";
	folderActions?: FolderActions;
	/** Right-click / `⋯` menu of a row. For a selected row, targets the whole selection. */
	rowMenu: (item: ListEntriesItem) => MenuAction[];
	/** Right-click menu on empty space in the list. */
	blankMenu?: MenuAction[];
	/** Delete key on a row. On the list it moves to trash; in trash it asks about permanent delete. */
	onDeleteKey?: (item: ListEntriesItem) => void;
	onSelectFolder: (folder: string) => void;
	onOpenRecord: (item: ListEntriesItem) => void;
	/** Item open in the right taxonomy edit slot. Highlights that row. */
	openRecordId?: string | null;
	onRestore?: (item: ListEntriesItem) => void;
	onPermanentDelete?: (item: ListEntriesItem) => void;
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: PageSize) => void;
	onRetry: () => void;
	/** Adds an item. Shown in the empty list as the way to start. */
	addAction?: { label: string; run: () => void };
	/** Drawn between the sub-toolbar and the table (the bulk action row). */
	aboveTable?: ReactNode;
	/** Name of the collection, for "Write a new …" in the welcome state. */
	collectionLabel?: string;
}

export function AdminEntriesTable({
	collection,
	items,
	folders,
	explorer,
	state,
	options,
	onStateChange,
	columnSettings,
	onColumnSettingsChange,
	selectedIds,
	onSelectionChange,
	total,
	isLoading,
	isRefreshing = false,
	errorMessage,
	mode = "list",
	folderActions,
	rowMenu,
	blankMenu,
	onDeleteKey,
	onSelectFolder,
	onOpenRecord,
	openRecordId = null,
	onRestore,
	onPermanentDelete,
	onPageChange,
	onPageSizeChange,
	onRetry,
	addAction,
	aboveTable,
	collectionLabel,
}: TableProps) {
	const site = useSite();
	const { listCells } = useAdminComponents();
	const t = useTranslator(screensMessages);
	const tc = useTranslator(commonMessages);
	const isTrash = mode === "trash";
	const isRecord = site.isItemCollection(collection);
	const { table, order, visibility, isShown, scrollRef, moveColumn } = useEntriesTable({
		collection,
		items,
		folders,
		explorer,
		state,
		options,
		onStateChange,
		columnSettings,
		onColumnSettingsChange,
		selectedIds,
		onSelectionChange,
		mode,
		rowMenu,
		onOpenRecord,
		onRestore,
		onPermanentDelete,
	});

	const showFolderBesideTitle = !explorer && !isTrash && !isRecord && folders.length > 0 && visibility.folder === false;
	const filterColumns = order.filter((column) => {
		if (column === "title") return false;
		const filter = filterFor(site, collection, column, mode);
		if (filter.kind === "none") return false;
		if (filter.kind === "date") return isColumnFiltered(state, filter);
		return visibility[column] !== false || isColumnFiltered(state, filter);
	});
	// A date the table has no room for (the post date goes first, then the others) is left out, like a hidden column: the row does not run past the page.
	const dateColumns = order.filter(
		(column) => DATE_COLUMNS.has(column) && visibility[column] !== false && isShown(column),
	);

	const rowKeyDown = (item: ListEntriesItem) => (event: KeyboardEvent) => {
		if (event.key !== "Delete" || !onDeleteKey) return;
		const target = event.target as HTMLElement;
		if (target.closest("input, textarea, [contenteditable=true]")) return;
		event.preventDefault();
		onDeleteKey(item);
	};

	const pageHref = (page: number) => `?page=${page}`;

	return (
		<Stack as="section" aria-label={t("list.label")} gap={0} grow minHeight={0} overflow="hidden">
			<Box width="full" maxWidth="content" centered paddingX={32} shrink={false}>
				<ListSubToolbar
					state={state}
					options={options}
					mode={mode}
					onChange={onStateChange}
					trailing={
						<>
							<Checkbox
								checked={table.getIsAllPageRowsSelected()}
								indeterminate={table.getIsSomePageRowsSelected()}
								onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
								aria-label={t("list.selectAll")}
							/>
							{filterColumns.map((column) => (
								<ColumnHeader
									key={column}
									column={column}
									filter={filterFor(site, collection, column, mode)}
									state={state}
									options={options}
									onChange={onStateChange}
								/>
							))}
							<ListViewPopover
								collection={collection}
								state={state}
								order={order}
								visibility={visibility}
								onToggle={(column, visible) => table.getColumn(column)?.toggleVisibility(visible)}
								onMove={moveColumn}
								onStateChange={onStateChange}
								onPageSizeChange={onPageSizeChange}
							/>
						</>
					}
				/>
				{aboveTable}
				{errorMessage && (
					<Box paddingTop={12}>
						<LoadErrorAlert message={errorMessage} onRetry={onRetry} />
					</Box>
				)}
			</Box>

			<Stack gap={0} grow minHeight={0} overflow="auto">
				<Box ref={scrollRef} width="full" maxWidth="content" centered paddingX={32}>
					<Table container="none">
						<TableBody aria-busy={isRefreshing || undefined} dimmed={isRefreshing}>
							{explorer && (
								<EntriesTableFolderRows
									explorer={explorer}
									folders={folders}
									folderActions={folderActions}
									visibleCount={3}
									onSelectFolder={onSelectFolder}
								/>
							)}
							{isLoading ? (
								<TableRow>
									<TableCell colSpan={3}>
										<Text as="span" variant="note" tone="subtle" role="status">
											{tc("loading")}
										</Text>
									</TableCell>
								</TableRow>
							) : items.length === 0 ? null : (
								table.getRowModel().rows.map((row) => {
									const subtitleColumns = order.filter(
										(column) =>
											!HEADER_COLUMNS.has(column) &&
											visibility[column] !== false &&
											hasEntryCellValue(site, listCells, collection, column, row.original, folders),
									);
									return (
										<ActionContextMenu
											key={row.id}
											actions={rowMenu(row.original)}
											trigger={
												<TableRow
													selected={row.getIsSelected() || row.original.id === openRecordId}
													aria-current={row.original.id === openRecordId ? "true" : undefined}
													data-state={row.getIsSelected() ? "selected" : undefined}
													draggable={!isTrash}
													onDragStart={(event) => {
														// Dragging a selected row moves the whole selection; otherwise just this row.
														const group = selectedIds.has(row.original.id)
															? items.filter((item) => selectedIds.has(item.id))
															: [row.original];
														writeDraggedEntries(
															event,
															group.map((item) => ({ id: item.id, expectedVersion: item.version })),
															group.length === 1
																? group[0]?.title || tc("untitled")
																: t("list.itemsCount", { count: group.length }),
														);
													}}
													onKeyDown={rowKeyDown(row.original)}
												/>
											}
										>
											<TableCell width="xs">
												<Checkbox
													checked={row.getIsSelected()}
													onCheckedChange={(value) => row.toggleSelected(value === true)}
													aria-label={t("list.rowSelect", { title: row.original.title ?? tc("untitled") })}
												/>
											</TableCell>
											<TableCell wrap>
												<Stack gap={4} minWidth={0}>
													<EntryCell
														collection={collection}
														column="title"
														item={row.original}
														folders={folders}
														isTrash={isTrash}
														isRecord={isRecord}
														showFolderBesideTitle={showFolderBesideTitle}
														showSlugBesideTitle
														onOpenRecord={onOpenRecord}
													/>
													{subtitleColumns.length > 0 && (
														<Inline wrap gap={8} minWidth={0}>
															{subtitleColumns.map((column, index) => (
																<Fragment key={column}>
																	{index > 0 && (
																		<Text variant="caption" tone="muted" aria-hidden>
																			·
																		</Text>
																	)}
																	<Text as="span" variant="caption" tone="muted">
																		<EntryCell
																			collection={collection}
																			column={column}
																			item={row.original}
																			folders={folders}
																			isTrash={isTrash}
																			isRecord={isRecord}
																			showFolderBesideTitle={false}
																			showSlugBesideTitle={false}
																			onOpenRecord={onOpenRecord}
																		/>
																	</Text>
																</Fragment>
															))}
														</Inline>
													)}
												</Stack>
											</TableCell>
											<TableCell align="end">
												<Inline gap={12} justify="end">
													{!isTrash && visibility.status !== false && (
														<EntryCell
															collection={collection}
															column="status"
															item={row.original}
															folders={folders}
															isTrash={isTrash}
															isRecord={isRecord}
															showFolderBesideTitle={false}
															showSlugBesideTitle={false}
															onOpenRecord={onOpenRecord}
														/>
													)}
													{dateColumns
														.filter((column) =>
															hasEntryCellValue(site, listCells, collection, column, row.original, folders),
														)
														.map((column) => (
															<EntryCell
																key={column}
																collection={collection}
																column={column}
																item={row.original}
																folders={folders}
																isTrash={isTrash}
																isRecord={isRecord}
																showFolderBesideTitle={false}
																showSlugBesideTitle={false}
																onOpenRecord={onOpenRecord}
															/>
														))}
													<Inline gap={4} justify="end">
														{isTrash && (
															<>
																<TextButton type="button" onClick={() => onRestore?.(row.original)}>
																	{tc("lifecycle.restore")}
																</TextButton>
																<TextButton
																	type="button"
																	variant="danger"
																	onClick={() => onPermanentDelete?.(row.original)}
																>
																	{tc("lifecycle.deletePermanently")}
																</TextButton>
															</>
														)}
														<MoreActionsButton
															actions={rowMenu(row.original)}
															label={t("list.rowActions", { title: row.original.title ?? tc("untitled") })}
														/>
													</Inline>
												</Inline>
											</TableCell>
										</ActionContextMenu>
									);
								})
							)}
						</TableBody>
					</Table>
					{!isLoading &&
						!errorMessage &&
						items.length === 0 &&
						!explorer?.folders.length &&
						(isTrash ? (
							<EmptyState title={t("list.emptyTrash")} />
						) : isFiltered(state) ? (
							<EmptyState
								title={t("list.emptyNoMatch")}
								description={t("list.emptyNoMatchHint")}
								action={{ label: t("list.clearFilters"), onClick: () => onStateChange(clearFiltersPatch(state)) }}
							/>
						) : site.isDocumentCollection(collection) && addAction && folders.length === 0 ? (
							<EmptyState
								title={t("list.welcomeTitle")}
								description={t("list.welcomeHint")}
								action={{
									label: t("list.writeNew", { label: collectionLabel ?? collection }),
									onClick: addAction.run,
								}}
								secondaryAction={{
									label: t("list.importMarkdown"),
									href: `${site.adminHref("/tools/data")}#import-entries`,
								}}
							/>
						) : (
							<EmptyState
								title={t("list.emptyYet")}
								description={t("list.emptyYetHint")}
								action={addAction && { label: addAction.label, onClick: addAction.run }}
							/>
						))}
				</Box>
				{blankMenu && (
					<ActionContextMenu
						actions={blankMenu}
						trigger={<Box grow paddingY={16} aria-hidden data-testid="list-blank-area" />}
					/>
				)}
			</Stack>

			<Box width="full" maxWidth="content" centered shrink={false}>
				<ListPagination
					total={total}
					shown={items.length}
					page={state.page}
					pageSize={state.pageSize}
					onPageChange={onPageChange}
					hrefFor={pageHref}
					showPageSize={false}
					hidePagerWhenSingle
					showRange={false}
				/>
			</Box>
		</Stack>
	);
}
