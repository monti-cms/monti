"use client";

import type { Folder, ListEntriesItem } from "@monti-cms/core/site";
import { type AdminColumnSettings, type PageSize, useSite, useTranslator } from "@monti-cms/core/site";
import { Box, type SelectAllState, Stack, Table, TableBody, TableCell, TableRow, Text } from "@monti-cms/ui";
import type { KeyboardEvent, ReactNode } from "react";
import { commonMessages } from "../lib/common.messages";
import { EntriesTableFolderRows } from "./entries-table-folder-rows";
import { cellSizesOf, EntryRowCells } from "./entries-table-row";
import { monthMarks } from "./list-row-dates";
import { clearFiltersPatch, isFiltered, type ListState } from "./list-state";
import { ListToolbar } from "./list-toolbar";
import { screensMessages } from "./messages";
import { ActionContextMenu, type MenuAction } from "./shared/action-menu";
import { EmptyState } from "./shared/empty-state";
import { writeDraggedEntries } from "./shared/entry-drag";
import { ListPagination } from "./shared/list-pager";
import { LoadErrorAlert } from "./shared/load-error-alert";
import type { FolderActions } from "./shared/use-folder-actions";
import { useEntriesTable } from "./use-entries-table";

interface TableProps {
	collection: string;
	items: ListEntriesItem[];
	folders: Folder[];
	/** Subfolders and move-to-parent shown above the list in folder browse mode. */
	explorer: { folders: Folder[]; parent: string | null } | null;
	state: ListState;
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
	/** What replaces the toolbar while rows are picked (the bulk bar). It is given the select-all, which stays where it was. */
	bulkBar?: (selectAll: { state: SelectAllState; onChange: (all: boolean) => void; label: string }) => ReactNode;
	/** Name of the collection, for "Write a new …" in the welcome state. */
	collectionLabel?: string;
}

export function AdminEntriesTable({
	collection,
	items,
	folders,
	explorer,
	state,
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
	bulkBar,
	collectionLabel,
}: TableProps) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const tc = useTranslator(commonMessages);
	const isTrash = mode === "trash";
	const isRecord = site.isItemCollection(collection);
	const { table, order, visibility, isShown, scrollRef, moveColumn, reorderColumn, toggleColumn } = useEntriesTable({
		collection,
		items,
		folders,
		explorer,
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
	// The columns after the title: the ones turned on that the page has room for (the ones hidden first when it is narrow are left out, as a hidden column is).
	const rowColumns = order.filter((column) => column !== "title" && visibility[column] !== false && isShown(column));
	const marks = monthMarks(site, items, state.sortField);

	const rowKeyDown = (item: ListEntriesItem) => (event: KeyboardEvent) => {
		if (event.key !== "Delete" || !onDeleteKey) return;
		const target = event.target as HTMLElement;
		if (target.closest("input, textarea, [contenteditable=true]")) return;
		event.preventDefault();
		onDeleteKey(item);
	};

	const pageHref = (page: number) => `?page=${page}`;
	const selectAllState: SelectAllState = table.getIsAllPageRowsSelected()
		? "all"
		: table.getIsSomePageRowsSelected()
			? "some"
			: "none";
	const selectAll = {
		state: selectAllState,
		onChange: (all: boolean) => table.toggleAllPageRowsSelected(all),
		label: t("list.selectAll"),
	};

	return (
		<Stack as="section" aria-label={t("list.label")} gap={0} grow minHeight={0} overflow="hidden">
			<Box width="full" maxWidth="content" centered paddingX={32} shrink={false}>
				{selectedIds.size > 0 && bulkBar ? (
					bulkBar(selectAll)
				) : (
					<ListToolbar
						state={state}
						mode={mode}
						total={isLoading ? undefined : total}
						selectAll={selectAll}
						onChange={onStateChange}
						order={order}
						visibility={visibility}
						onPageSizeChange={onPageSizeChange}
						onToggleColumn={toggleColumn}
						onReorderColumn={reorderColumn}
						onMoveColumn={moveColumn}
					/>
				)}
				{errorMessage && (
					<Box paddingTop={12}>
						<LoadErrorAlert message={errorMessage} onRetry={onRetry} />
					</Box>
				)}
			</Box>

			<Stack gap={0} grow minHeight={0} overflow="auto">
				<Box ref={scrollRef} width="full" maxWidth="content" centered paddingX={32}>
					<Table container="none" layout="fixed">
						<TableBody aria-busy={isRefreshing || undefined} dimmed={isRefreshing}>
							{explorer && (
								<EntriesTableFolderRows
									explorer={explorer}
									folders={folders}
									folderActions={folderActions}
									cellSizes={cellSizesOf(
										new Set(site.taxonomyFieldsOf(collection).map((stored) => stored.name)),
										rowColumns,
									)}
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
								table.getRowModel().rows.map((row, index) => (
									<ActionContextMenu
										key={row.id}
										actions={rowMenu(row.original)}
										trigger={
											<TableRow
												selected={row.getIsSelected() || row.original.id === openRecordId}
												aria-current={row.original.id === openRecordId ? "true" : undefined}
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
										<EntryRowCells
											collection={collection}
											item={row.original}
											columns={rowColumns}
											monthMark={marks[index] ?? null}
											sortField={state.sortField}
											folders={folders}
											isTrash={isTrash}
											isRecord={isRecord}
											showFolderBesideTitle={showFolderBesideTitle}
											showSlugBesideTitle={visibility.slug === false}
											selected={row.getIsSelected()}
											onSelect={(value) => row.toggleSelected(value)}
											menu={rowMenu(row.original)}
											onOpenRecord={onOpenRecord}
											onRestore={onRestore}
											onPermanentDelete={onPermanentDelete}
										/>
									</ActionContextMenu>
								))
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
									href: `${site.adminHref("/data")}#import-entries`,
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
				/>
			</Box>
		</Stack>
	);
}
