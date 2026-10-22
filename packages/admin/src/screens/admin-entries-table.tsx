"use client";

import type { Folder, ListEntriesItem } from "@monti-cms/core/site";
import { type AdminColumnSettings, type PageSize, useSite, useTranslator } from "@monti-cms/core/site";
import { Box, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@monti-cms/ui";
import { FileUp, Inbox, PenLine, Plus, SearchX, Trash2 } from "lucide-react";
import { Fragment, type KeyboardEvent, type ReactNode } from "react";
import { commonMessages } from "../lib/common.messages";
import { ColumnResizeHandle } from "./column-resize-handle";
import { EntriesTableFolderRows } from "./entries-table-folder-rows";
import { MAX_COLUMN_SIZE, MIN_COLUMN_SIZE } from "./entries-table-widths";
import { columnConfig, columnLabel } from "./list-columns";
import { clearFiltersPatch, isFiltered, type ListState } from "./list-state";
import { ListSubToolbar } from "./list-toolbar";
import { ListViewPopover } from "./list-view-popover";
import { screensMessages } from "./messages";
import { ActionContextMenu, type MenuAction } from "./shared/action-menu";
import { EmptyState } from "./shared/empty-state";
import { writeDraggedEntries } from "./shared/entry-drag";
import { ListPagination } from "./shared/list-pager";
import { LoadErrorAlert } from "./shared/load-error-alert";
import type { FolderActions } from "./shared/use-folder-actions";
import type { TaxonomyOptions } from "./shared/use-taxonomy";
import { useEntriesTable } from "./use-entries-table";

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
	const t = useTranslator(screensMessages);
	const tc = useTranslator(commonMessages);
	const isTrash = mode === "trash";
	const {
		table,
		order,
		visibility,
		scrollRef,
		isShown,
		visibleCount,
		tableSizing,
		freezeTitle,
		updateSizing,
		moveColumn,
	} = useEntriesTable({
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

	const rowKeyDown = (item: ListEntriesItem) => (event: KeyboardEvent) => {
		if (event.key !== "Delete" || !onDeleteKey) return;
		const target = event.target as HTMLElement;
		if (target.closest("input, textarea, [contenteditable=true]")) return;
		event.preventDefault();
		onDeleteKey(item);
	};

	const pageHref = (page: number) => `?page=${page}`;

	return (
		<Stack as="section" aria-label={t("list.label")} gap="none" grow minHeight={0} overflow="hidden">
			<ListSubToolbar
				state={state}
				options={options}
				mode={mode}
				onChange={onStateChange}
				trailing={
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
				}
			/>
			{aboveTable}
			{errorMessage && (
				<Box paddingX="wide" paddingTop="normal">
					<LoadErrorAlert message={errorMessage} onRetry={onRetry} />
				</Box>
			)}

			<Stack ref={scrollRef} gap="none" grow minHeight={0} overflow="auto">
				<Table layout="fixed" container="none" stickyHeader inset="page">
					<TableHeader>
						{table.getHeaderGroups().map((group) => (
							<TableRow key={group.id}>
								{group.headers
									.filter((header) => isShown(header.column.id))
									.map((header) => {
										const sortField = columnConfig(site, collection, header.column.id).sortField;
										const active = sortField !== undefined && sortField === state.sortField;
										return (
											<Fragment key={header.id}>
												{header.column.id === "actions" && <TableHead aria-hidden size={0} />}
												<TableHead
													size={header.getSize()}
													aria-sort={active ? (state.sortDirection === "asc" ? "ascending" : "descending") : undefined}
												>
													{header.isPlaceholder ? null : <table.FlexRender header={header} />}
													{header.column.getCanResize() && (
														<ColumnResizeHandle
															label={columnLabel(site, collection, header.column.id)}
															width={header.getSize()}
															resizing={header.column.getIsResizing()}
															onStart={(event) => {
																freezeTitle();
																header.getResizeHandler()(event);
															}}
															onNudge={(delta) =>
																updateSizing((current) => ({
																	...tableSizing,
																	...current,
																	[header.column.id]: Math.min(
																		MAX_COLUMN_SIZE,
																		Math.max(MIN_COLUMN_SIZE, header.getSize() + delta),
																	),
																}))
															}
															onReset={() =>
																updateSizing((current) => {
																	const { [header.column.id]: _removed, ...rest } = current;
																	return rest;
																})
															}
														/>
													)}
												</TableHead>
											</Fragment>
										);
									})}
							</TableRow>
						))}
					</TableHeader>
					<TableBody aria-busy={isRefreshing || undefined}>
						{explorer && (
							<EntriesTableFolderRows
								explorer={explorer}
								folders={folders}
								folderActions={folderActions}
								visibleCount={visibleCount}
								onSelectFolder={onSelectFolder}
							/>
						)}
						{isLoading
							? Array.from({ length: 5 }, (_, index) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: placeholder row
									<TableRow key={index} aria-hidden>
										<TableCell colSpan={visibleCount}>
											<Skeleton />
										</TableCell>
									</TableRow>
								))
							: items.length === 0
								? null
								: table.getRowModel().rows.map((row) => (
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
											{row
												.getVisibleCells()
												.filter((cell) => isShown(cell.column.id))
												.map((cell) => (
													<Fragment key={cell.id}>
														{cell.column.id === "actions" && <TableCell aria-hidden size={0} />}
														<TableCell truncate>
															<table.FlexRender cell={cell} />
														</TableCell>
													</Fragment>
												))}
										</ActionContextMenu>
									))}
					</TableBody>
				</Table>
				{!isLoading &&
					!errorMessage &&
					items.length === 0 &&
					!explorer?.folders.length &&
					(isTrash ? (
						<EmptyState icon={Trash2} title={t("list.emptyTrash")} />
					) : isFiltered(state) ? (
						<EmptyState
							icon={SearchX}
							title={t("list.emptyNoMatch")}
							description={t("list.emptyNoMatchHint")}
							action={{ label: t("list.clearFilters"), onClick: () => onStateChange(clearFiltersPatch(state)) }}
						/>
					) : site.isDocumentCollection(collection) && addAction && folders.length === 0 ? (
						<EmptyState
							icon={PenLine}
							title={t("list.welcomeTitle")}
							description={t("list.welcomeHint")}
							action={{
								label: t("list.writeNew", { label: collectionLabel ?? collection }),
								icon: Plus,
								onClick: addAction.run,
								emphasis: "primary",
							}}
							secondaryAction={{
								label: t("list.importMarkdown"),
								icon: FileUp,
								href: `${site.adminHref("/data")}#import-entries`,
							}}
						/>
					) : (
						<EmptyState
							icon={Inbox}
							title={t("list.emptyYet")}
							description={t("list.emptyYetHint")}
							action={addAction && { label: addAction.label, icon: Plus, onClick: addAction.run }}
						/>
					))}
				{blankMenu && (
					<ActionContextMenu
						actions={blankMenu}
						trigger={<Box grow paddingY="comfortable" aria-hidden data-testid="list-blank-area" />}
					/>
				)}
			</Stack>

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
		</Stack>
	);
}
