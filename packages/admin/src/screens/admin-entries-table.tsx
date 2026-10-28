"use client";

import type { Folder, ListEntriesItem } from "@monti-cms/core/site";
import { type AdminColumnSettings, type PageSize, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Chip,
	ChipRow,
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
import { type KeyboardEvent, type ReactNode, useState } from "react";
import { commonMessages } from "../lib/common.messages";
import { EntriesTableFolderRows } from "./entries-table-folder-rows";
import { EntryRowCells } from "./entries-table-row";
import { ACTIONS_SIZE, columnSize } from "./entries-table-widths";
import { columnMenuOf, hiddenColumns, isColumnFiltered } from "./list-column-menu";
import { ColumnMenuContent } from "./list-column-values";
import { type AdminListColumn, columnConfig, columnLabel } from "./list-columns";
import { filterChipsOf } from "./list-filter-model";
import { clearFiltersPatch, isFiltered, type ListState } from "./list-state";
import { screensMessages } from "./messages";
import { ActionContextMenu, type MenuAction } from "./shared/action-menu";
import { EmptyState } from "./shared/empty-state";
import { writeDraggedEntries } from "./shared/entry-drag";
import { ListPagination } from "./shared/list-pager";
import { LoadErrorAlert } from "./shared/load-error-alert";
import { collectionNoun } from "./shared/noun.messages";
import type { FolderActions } from "./shared/use-folder-actions";
import { useFilterTitles } from "./use-filter-titles";
import { useListColumns } from "./use-list-columns";

/** Dates sit at the end of their cells, so the days line up. */
const DATE_COLUMNS: readonly AdminListColumn[] = ["updatedAt", "createdAt", "publishedAt"];

interface TableProps {
	collection: string;
	items: ListEntriesItem[];
	folders: Folder[];
	/** Subfolders and move-to-parent shown above the list in folder browse mode. */
	explorer: { folders: (Folder & { entryCount?: number })[]; parent: string | null } | null;
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
	folderActions?: FolderActions;
	/** Right-click / `⋯` menu of a row. For a selected row, targets the whole selection. */
	rowMenu: (item: ListEntriesItem) => MenuAction[];
	/** Right-click menu on empty space in the list. */
	blankMenu?: MenuAction[];
	/** Delete key on a row: moves it to the trash. */
	onDeleteKey?: (item: ListEntriesItem) => void;
	onSelectFolder: (folder: string) => void;
	onOpenRecord: (item: ListEntriesItem) => void;
	/** Item open in the right taxonomy edit slot. Highlights that row. */
	openRecordId?: string | null;
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: PageSize) => void;
	onRetry: () => void;
	/** Adds an item. Shown in the empty list as the way to start. */
	addAction?: { label: string; run: () => void };
	/**
	 * What replaces the head row while rows are picked (the bulk bar). It is given the select-all, which moves onto it, and how many columns the table has,
	 * the bar being a row of it.
	 */
	bulkBar?: (parts: {
		selectAll: { state: SelectAllState; onChange: (all: boolean) => void; label: string };
		colSpan: number;
	}) => ReactNode;
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
	folderActions,
	rowMenu,
	blankMenu,
	onDeleteKey,
	onSelectFolder,
	onOpenRecord,
	openRecordId = null,
	onPageChange,
	onPageSizeChange,
	onRetry,
	addAction,
	bulkBar,
}: TableProps) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const tc = useTranslator(commonMessages);
	const isRecord = site.isItemCollection(collection);
	const columns = useListColumns({ collection, columnSettings, onColumnSettingsChange });
	const { order, visibility, scrollRef } = columns;
	const shown = columns.shown;
	const showFolderBesideTitle = !explorer && !isRecord && folders.length > 0 && visibility.folder === false;
	const head: ListHeadColumn[] = shown.map((column) => {
		const sortField = columnConfig(site, collection, column).sortField;
		const menu = columnMenuOf(site, collection, column);
		return {
			id: column,
			label: columnLabel(site, collection, column),
			size: columnSize(site, collection, column),
			align: DATE_COLUMNS.includes(column) ? "end" : "start",
			sort: sortField !== undefined && state.sortField === sortField ? state.sortDirection : undefined,
			filtered: isColumnFiltered(site, collection, column, state),
			menu:
				menu.sort || menu.filter || menu.hide ? (
					<ColumnMenuContent
						menu={menu}
						state={state}
						onChange={onStateChange}
						onHide={() => columns.toggle(column, false)}
					/>
				) : undefined,
		};
	});
	const off = hiddenColumns(order, visibility);
	const add = {
		label: t("column.add"),
		columns: off.map((column) => ({ id: column, label: columnLabel(site, collection, column) })),
		onAdd: (column: AdminListColumn) => columns.toggle(column, true),
	};
	const titles = useFilterTitles(state);
	const liveChips = filterChipsOf(site, state, titles);
	// While a column's menu is open the chips row holds the chips it had when the menu opened (or stays absent): a row that appears or goes pushes the head
	// and the menu under the pointer. The rows, the counts, the dots and the ticks keep following the filters.
	const [frozenChips, setFrozenChips] = useState<typeof liveChips | null>(null);
	const chips = frozenChips ?? liveChips;
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
	/** Rows are picked: the bulk bar is the head row, and holds the select-all. */
	const picking = selectedIds.size > 0 && bulkBar !== undefined;
	const select = (item: ListEntriesItem, on: boolean) => {
		const next = new Set(selectedIds);
		if (on) next.add(item.id);
		else next.delete(item.id);
		onSelectionChange(next);
	};

	return (
		<Stack as="section" aria-label={t("list.label")} gap={0} grow minHeight={0}>
			<Box width="full" shrink={false}>
				{chips.length > 0 && (
					<ChipRow>
						{chips.map((chip) => (
							<Chip
								key={chip.key}
								onRemove={() => onStateChange(chip.clear)}
								removeLabel={t("listMenu.chipRemove", { label: chip.label })}
							>
								{chip.label}
							</Chip>
						))}
					</ChipRow>
				)}
				{errorMessage && (
					<Box paddingTop={12}>
						<LoadErrorAlert message={errorMessage} onRetry={onRetry} />
					</Box>
				)}
			</Box>

			<ListScroll>
				<Box ref={scrollRef} width="full">
					<Table
						container="none"
						layout="fixed"
						columns={[...shown.map((column) => columnSize(site, collection, column)), ACTIONS_SIZE]}
					>
						{picking ? (
							bulkBar({ selectAll, colSpan: shown.length + 1 })
						) : (
							<ListHead
								columns={head}
								end={ACTIONS_SIZE}
								add={add}
								selectAll={selectAll}
								moveLabel={t("list.columnMove")}
								onPlace={columns.place}
								onStep={columns.step}
								onPreview={columns.setPreview}
								onMenuOpenChange={(open) => setFrozenChips(open ? liveChips : null)}
							/>
						)}
						<TableBody aria-busy={isRefreshing || undefined} dimmed={isRefreshing}>
							{explorer && (
								<EntriesTableFolderRows
									explorer={explorer}
									folders={folders}
									folderActions={folderActions}
									span={shown.length}
									before={shown.slice(0, shown.indexOf("title"))}
									countLabel={(count) => t("list.folderCount", { noun: collectionNoun(site, collection), count })}
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
												draggable
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
											isRecord={isRecord}
											showFolderBesideTitle={showFolderBesideTitle}
											showSlugBesideTitle={visibility.slug === false}
											selected={selectedIds.has(item.id)}
											onSelect={(on) => select(item, on)}
											menu={rowMenu(item)}
											onOpenRecord={onOpenRecord}
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
						(isFiltered(state) ? (
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
					onPageSizeChange={onPageSizeChange}
					hidePagerWhenSingle
				/>
			</Box>
		</Stack>
	);
}
