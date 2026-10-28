"use client";

import { Add, FolderAdd } from "@carbon/icons-react";
import type { AdminColumnSettings } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Button,
	Inline,
	PageColumn,
	PageHeader,
	PageToolbar,
	Segmented,
	Stack,
	Text,
	TextButton,
	toast,
} from "@monti-cms/ui";
import { useEffect, useState } from "react";
import { commonMessages } from "../lib/common.messages";
import { AdminEntriesTable } from "./admin-entries-table";
import { BulkBar } from "./entries/bulk-bar";
import { ExportDialog } from "./export/export-dialog";
import { ListSearch } from "./list-search";
import { searchScopeChoice } from "./list-state";
import { screensMessages } from "./messages";
import { folderPath } from "./rail-folders";
import { RecordPanel } from "./record-panel";
import { AdminFrame, AdminNavProvider } from "./shared/admin-frame";
import { collectionNoun } from "./shared/noun.messages";
import { usePublishScreenContext } from "./shared/screen-context";
import { DockedPanel } from "./shared/side-panel";
import { type EntryList, useEntryList } from "./use-entry-list";

/**
 * Top right above the list: search, then the one add button. A collection of writing is "+ New post" in the one primary pill;
 * a collection of items (categories, tags) is "+ Add category" in a secondary pill.
 */
function EntryListHeaderActions({ list }: { list: EntryList }) {
	const t = useTranslator(screensMessages);
	const site = useSite();
	const isItems = site.isItemCollection(list.state.collection);
	return (
		<>
			{list.folders && <TextButton onClick={list.folders.addFolder}>{t("list.addFolder")}</TextButton>}
			<ListSearch state={list.state} onChange={list.update} />
			<Button type="button" variant={isItems ? "secondary" : "primary"} onClick={list.createNew}>
				<Add aria-hidden />
				{isItems ? t("list.add", { label: list.label }) : t("list.writeNew")}
			</Button>
		</>
	);
}

/**
 * The row a search inside a folder adds under the title: where to look, this folder (and the folders below it) or all folders. At the top level a search
 * already looks everywhere, so there is no choice.
 */
function SearchScope({ list }: { list: EntryList }) {
	const t = useTranslator(screensMessages);
	const { state, folders } = list;
	const current = folders?.list.find((folder) => folder.id === state.folder);
	if (!current || !searchScopeChoice(state)) return null;
	return (
		<PageToolbar inset>
			<Segmented
				size="sm"
				inline
				aria-label={t("toolbar.scope")}
				value={state.searchAll ? "all" : "folder"}
				onValueChange={(scope) => list.update({ searchAll: scope === "all" })}
				options={[
					{ value: "folder", label: current.name },
					{ value: "all", label: t("toolbar.scopeAll") },
				]}
			/>
		</PageToolbar>
	);
}

/** List body: filter chips, bulk action row, table, taxonomy edit panel, and the dialogs list actions open. */
function EntryListBody({ list }: { list: EntryList }) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const tc = useTranslator(commonMessages);
	const { state, data, folders } = list;
	const { items } = data;
	const record = list.recordTarget;
	// The rows picked in the list, for the side panel; ids of rows that left the page (a filter, a search) are not offered.
	usePublishScreenContext({
		collection: state.collection,
		selectedIds: items.filter((item) => list.selectedIds.has(item.id)).map((item) => item.id),
	});
	return (
		<>
			{/* Nothing here clips: the row checks hang in the page's left margin. */}
			<Inline position="relative" align="stretch" gap={0} grow minHeight={0}>
				<Stack gap={0} grow minWidth={0}>
					<SearchScope list={list} />
					<AdminEntriesTable
						bulkBar={({ selectAll, colSpan }) => (
							<BulkBar
								collection={state.collection}
								rows={items.filter((item) => list.selectedIds.has(item.id))}
								folders={folders?.list ?? null}
								selectAll={selectAll}
								colSpan={colSpan}
								onClearSelection={() => list.setSelectedIds(new Set())}
								onRun={list.mutations.bulk}
								onExport={list.exportEntries}
							/>
						)}
						collection={state.collection}
						items={items}
						folders={data.folders}
						explorer={list.explorer}
						state={state}
						onStateChange={(patch) => {
							list.update(patch);
							if (patch.sortField || patch.sortDirection) {
								list.savePreferences({
									sort: {
										field: patch.sortField ?? state.sortField,
										direction: patch.sortDirection ?? state.sortDirection,
									},
								});
							}
						}}
						columnSettings={list.columnSettings}
						onColumnSettingsChange={(columns: AdminColumnSettings) => list.savePreferences({ columns })}
						selectedIds={list.selectedIds}
						onSelectionChange={list.setSelectedIds}
						total={data.total}
						isLoading={data.isLoading}
						isRefreshing={data.isRefreshing}
						errorMessage={data.errorMessage}
						folderActions={folders?.actions}
						rowMenu={list.rowMenu}
						blankMenu={[
							...(folders
								? [
										{
											kind: "item" as const,
											label: state.folder === "all" ? tc("addFolder") : tc("addSubfolder"),
											icon: FolderAdd,
											onSelect: folders.addFolder,
										},
									]
								: []),
							{ kind: "item", label: t("list.add", { label: list.label }), icon: Add, onSelect: list.createNew },
						]}
						onDeleteKey={list.onDeleteKey}
						onSelectFolder={(folder) => list.update({ folder })}
						openRecordId={record?.collection === state.collection ? record.id : null}
						onOpenRecord={(item) => void list.openRecord({ collection: state.collection, id: item.id })}
						onPageChange={(page) => list.update({ page }, { resetPage: false })}
						onPageSizeChange={(pageSize) => {
							list.update({ pageSize });
							list.savePreferences({ pageSize });
						}}
						onRetry={data.retry}
						addAction={{ label: t("list.add", { label: list.label }), run: list.createNew }}
					/>
				</Stack>
				{record && (
					<DockedPanel>
						<RecordPanel
							key={`${record.collection}:${record.id ?? "new"}`}
							target={record}
							onDirtyChange={list.setRecordDirty}
							onClose={list.closeRecord}
							onSaved={(saved) => {
								// Keep the saved item open as is. For a new item, switch to editing the created item.
								if (!record.id) list.showRecord({ collection: record.collection, id: saved.id });
								toast(tc("saved"));
								void list.invalidateEntries();
								list.reloadTaxonomies();
							}}
						/>
					</DockedPanel>
				)}
			</Inline>
			{list.folderDialogs}
			{list.confirmDialog}
			{list.guardDialog}
			<ExportDialog
				open={list.exportIds !== null}
				onOpenChange={(open) => !open && list.closeExport()}
				kind="selected"
				ids={list.exportIds ?? []}
				noun={collectionNoun(site, state.collection)}
			/>
		</>
	);
}

// The admin list fetches data in the browser. Render after hydration so Base UI's auto IDs do not mismatch the server HTML.
function useMounted() {
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	return mounted;
}

/** Before the first render: a quiet line in the middle of the page, with nothing drawn in the shape of what will come. */
function ListLoading() {
	const tc = useTranslator(commonMessages);
	return (
		<Stack height="screen" align="center" justify="center" aria-busy="true">
			<Text as="p" tone="subtle" role="status">
				{tc("loading")}
			</Text>
		</Stack>
	);
}

/** List screen. Opens the collection list, with no separate stats dashboard. */
export function EntryListScreen() {
	const mounted = useMounted();
	if (!mounted) return <ListLoading />;

	return (
		<AdminNavProvider>
			<ListPage />
		</AdminNavProvider>
	);
}

function ListPage() {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const list = useEntryList();
	const { state, update, folders } = list;
	const routePath = site.schemaOf(state.collection).path;
	// Inside a folder: the folder is the title, and the way back is the path above it ("Posts /").
	const path = folders && state.folder !== "all" ? folderPath(folders.list, state.folder) : [];
	const current = path.at(-1);
	return (
		<AdminFrame
			sidebar={{
				activeNav: state.collection,
				folderNav: folders
					? {
							collection: state.collection,
							currentFolder: state.folder,
							folders: folders.list,
							onSelectFolder: (folder) => update({ folder }),
							onDropEntries: folders.moveEntries,
						}
					: undefined,
			}}
		>
			<PageColumn width="list">
				<PageHeader
					title={state.folder === "all" ? list.label : (current?.name ?? "")}
					meta={state.folder === "all" ? routePath || undefined : undefined}
					trail={
						path.length > 0 ? (
							<Inline as="nav" gap={6} aria-label={t("list.trail")}>
								{[{ id: "all", name: list.label }, ...path.slice(0, -1)].map((step) => (
									<Inline key={step.id} gap={6}>
										<TextButton variant="underline" onClick={() => update({ folder: step.id })}>
											{step.name}
										</TextButton>
										<span aria-hidden="true">/</span>
									</Inline>
								))}
							</Inline>
						) : undefined
					}
				>
					<EntryListHeaderActions list={list} />
				</PageHeader>
				<EntryListBody list={list} />
			</PageColumn>
		</AdminFrame>
	);
}
