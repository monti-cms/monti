"use client";

import type { Folder, ListEntriesItem } from "@monti-cms/core/site";
import { type AdminColumnSettings, type PageSize, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	ListHead,
	type ListHeadColumn,
	ListScroll,
	type SelectAllState,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
} from "@monti-cms/ui";
import type { KeyboardEvent, ReactNode } from "react";
import { commonMessages } from "../lib/common.messages";
import { EntriesTableFolderRows } from "./entries-table-folder-rows";
import { EntryRowCells } from "./entries-table-row";
import { ACTIONS_SIZE, columnSize } from "./entries-table-widths";
import { sortByColumn } from "./list-column-order";
import { type AdminListColumn, columnConfig, columnLabel } from "./list-columns";
import { clearFiltersPatch, isFiltered, type ListState } from "./list-state";
import { ListToolbar } from "./list-toolbar";
import { screensMessages } from "./messages";
import { ActionContextMenu, type MenuAction } from "./shared/action-menu";
import { EmptyState } from "./shared/empty-state";
import { writeDraggedEntries } from "./shared/entry-drag";
import { ListPagination } from "./shared/list-pager";
import { LoadErrorAlert } from "./shared/load-error-alert";
import type { FolderActions } from "./shared/use-folder-actions";
import { useListColumns } from "./use-list-columns";

/** Dates sit at the end of their cells, so the days line up. */
const DATE_COLUMNS: readonly AdminListColumn[] = ["updatedAt", "createdAt", "publishedAt"];

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
}: TableProps) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const tc = useTranslator(commonMessages);
	const isTrash = mode === "trash";
	const isRecord = site.isItemCollection(collection);
	const columns = useListColumns({ collection, columnSettings, onColumnSettingsChange });
	const { order, visibility, scrollRef } = columns;
	// Everything in the trash is trashed: its status says nothing there.
	const shown = isTrash ? columns.shown.filter((column) => column !== "status") : columns.shown;
	const showFolderBesideTitle = !explorer && !isTrash && !isRecord && folders.length > 0 && visibility.folder === false;
	const head: ListHeadColumn[] = shown.map((column) => {
		const sortField = columnConfig(site, collection, column).sortField;
		return {
			id: column,
			label: columnLabel(site, collection, column),
			size: columnSize(site, collection, column),
			align: DATE_COLUMNS.includes(column) ? "end" : "start",
			sort: sortField === undefined ? undefined : state.sortField === sortField ? state.sortDirection : null,
		};
	});
	const sortBy = (column: AdminListColumn) => {
		const field = columnConfig(site, collection, column).sortField;
		if (field) onStateChange(sortByColumn(field, state));
	};

	const rowKeyDown = (item: ListEntriesItem) => (event: KeyboardEvent) => {
		if (event.key !== "Delete" || !onDeleteKey) return;
		const target = event.target as HTMLElement;
		if (target.closest("input, textarea, [contenteditable=true]")) return;
		event.preventDefault();
		onDeleteKey(item);
	};

	const pageHref = (page: number) => `?page=${page}`;
	const picked = items.filter((item) => selectedIds.has(item.id)).length;
	const selectAll = {
		state: (picked === 0 ? "none" : picked === items.length ? "all" : "some") as SelectAllState,
		onChange: (all: boolean) => onSelectionChange(new Set(all ? items.map((item) => item.id) : [])),
		label: t("list.selectAll"),
	};
	const select = (item: ListEntriesItem, on: boolean) => {
		const next = new Set(selectedIds);
		if (on) next.add(item.id);
		else next.delete(item.id);
		onSelectionChange(next);
	};

	return (
		<Stack as="section" aria-label={t("list.label")} gap={0} grow minHeight={0}>
			<Box width="full" shrink={false}>
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
						onToggleColumn={columns.toggle}
					/>
				)}
				{errorMessage && (
					<Box paddingTop={12}>
						<LoadErrorAlert message={errorMessage} onRetry={onRetry} />
					</Box>
				)}
			</Box>

			<ListScroll>
				<Box ref={scrollRef} width="full">
					<Table container="none" layout="fixed">
						<ListHead
							columns={head}
							end={isTrash ? undefined : ACTIONS_SIZE}
							moveLabel={t("list.columnMove")}
							onSort={sortBy}
							onPlace={columns.place}
							onStep={columns.step}
							onPreview={columns.setPreview}
						/>
						<TableBody aria-busy={isRefreshing || undefined} dimmed={isRefreshing}>
							{explorer && (
								<EntriesTableFolderRows
									explorer={explorer}
									folders={folders}
									folderActions={folderActions}
									span={shown.length}
									onSelectFolder={onSelectFolder}
								/>
							)}
							{isLoading ? (
								<TableRow>
									<TableCell colSpan={shown.length + 1}>
										<Text as="span" variant="note" tone="subtle" role="status">
											{tc("loading")}
										</Text>
									</TableCell>
								</TableRow>
							) : items.length === 0 ? null : (
								items.map((item) => (
									<ActionContextMenu
										key={item.id}
										actions={rowMenu(item)}
										trigger={
											<TableRow
												selected={selectedIds.has(item.id) || item.id === openRecordId}
												aria-current={item.id === openRecordId ? "true" : undefined}
												draggable={!isTrash}
												onDragStart={(event) => {
													// Dragging a selected row moves the whole selection; otherwise just this row.
													const group = selectedIds.has(item.id)
														? items.filter((item) => selectedIds.has(item.id))
														: [item];
													writeDraggedEntries(
														event,
														group.map((item) => ({ id: item.id, expectedVersion: item.version })),
														group.length === 1
															? group[0]?.title || tc("untitled")
															: t("list.itemsCount", { count: group.length }),
													);
												}}
												onKeyDown={rowKeyDown(item)}
											/>
										}
									>
										<EntryRowCells
											collection={collection}
											item={item}
											columns={shown}
											folders={folders}
											isTrash={isTrash}
											isRecord={isRecord}
											showFolderBesideTitle={showFolderBesideTitle}
											showSlugBesideTitle={visibility.slug === false}
											selected={selectedIds.has(item.id)}
											onSelect={(on) => select(item, on)}
											menu={rowMenu(item)}
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
									label: t("list.writeNew"),
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
			</ListScroll>

			<Box width="full" shrink={false}>
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
