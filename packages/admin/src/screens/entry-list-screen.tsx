"use client";

import { Add, FolderAdd } from "@carbon/icons-react";
import type { AdminColumnSettings } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { Box, Button, Inline, Stack, Tabs, TabsList, TabsTrigger, Text, toast } from "@monti-cms/ui";
import { useEffect, useState } from "react";
import { commonMessages } from "../lib/common.messages";
import { AdminLink as Link } from "../router";
import { AdminEntriesTable } from "./admin-entries-table";
import { BulkBar } from "./entries/bulk-bar";
import { toSelection } from "./list-row-menu";
import { ListSearch } from "./list-search";
import { screensMessages } from "./messages";
import { RecordPanel } from "./record-panel";
import { AdminNavProvider, AdminShell, PageActions } from "./shared/admin-shell";
import { usePublishScreenContext } from "./shared/screen-context";
import { DockedPanel } from "./shared/side-panel";
import { type EntryList, useEntryList } from "./use-entry-list";

/** Top right above the list: search and add button (trash has no add). */
function EntryListHeaderActions({ list }: { list: EntryList }) {
	const t = useTranslator(screensMessages);
	const isTrash = list.mode === "trash";
	return (
		<>
			<ListSearch state={list.state} onChange={list.update} allowBody={!isTrash} />
			{!isTrash && (
				<Button type="button" size="sm" onClick={list.createNew}>
					<Add aria-hidden />
					{t("list.add", { label: list.label })}
				</Button>
			)}
		</>
	);
}

/** The line under the list title: where the collection is public (`Public at /posts/:slug`). */
function RouteDescription({ path }: { path: string }) {
	const t = useTranslator(screensMessages);
	return (
		<>
			{t("list.publicAt")}{" "}
			<Text as="code" variant="caption" tone="default" mono>
				{path}
			</Text>
		</>
	);
}

/** List body: filter chips, bulk action row, table, taxonomy edit panel, and the dialogs list actions open. */
function EntryListBody({ list }: { list: EntryList }) {
	const t = useTranslator(screensMessages);
	const tc = useTranslator(commonMessages);
	const { state, data, mode, folders } = list;
	const isTrash = mode === "trash";
	const { items } = data;
	const record = list.recordTarget;
	// The rows picked in the list, for the side panel; ids of rows that left the page (a filter, a search) are not offered.
	usePublishScreenContext({
		collection: state.collection,
		selectedIds: items.filter((item) => list.selectedIds.has(item.id)).map((item) => item.id),
	});
	return (
		<>
			<Inline position="relative" align="stretch" gap={0} grow minHeight={0} overflow="hidden">
				<Stack gap={0} grow minWidth={0} overflow="hidden">
					<AdminEntriesTable
						bulkBar={(selectAll) => (
							<BulkBar
								collection={state.collection}
								mode={mode}
								selected={items.filter((item) => list.selectedIds.has(item.id)).map(toSelection)}
								folders={folders?.list ?? null}
								selectAll={selectAll}
								onClearSelection={() => list.setSelectedIds(new Set())}
								onRun={list.mutations.bulk}
							/>
						)}
						collectionLabel={list.label}
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
						mode={mode}
						folderActions={folders?.actions}
						rowMenu={list.rowMenu}
						blankMenu={
							isTrash
								? undefined
								: [
										...(folders
											? [
													{
														kind: "item" as const,
														label: state.folder === "all" ? tc("addFolder") : tc("addSubfolder"),
														icon: FolderAdd,
														onSelect: () => folders.actions.requestCreate(state.folder === "all" ? null : state.folder),
													},
												]
											: []),
										{ kind: "item", label: t("list.add", { label: list.label }), icon: Add, onSelect: list.createNew },
									]
						}
						onDeleteKey={list.onDeleteKey}
						onSelectFolder={(folder) => list.update({ folder })}
						openRecordId={record?.collection === state.collection ? record.id : null}
						onOpenRecord={(item) => void list.openRecord({ collection: state.collection, id: item.id })}
						onRestore={(item) => void list.restore([toSelection(item)])}
						onPermanentDelete={(item) => list.confirmPermanentDelete([toSelection(item)])}
						onPageChange={(page) => list.update({ page }, { resetPage: false })}
						onPageSizeChange={(pageSize) => {
							list.update({ pageSize });
							list.savePreferences({ pageSize });
						}}
						onRetry={data.retry}
						addAction={isTrash ? undefined : { label: t("list.add", { label: list.label }), run: list.createNew }}
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

/** Trash-only screen. Split by collection tabs, offering only restore and permanent delete. */
export function TrashScreen() {
	const mounted = useMounted();
	if (!mounted) return <ListLoading />;

	return (
		<AdminNavProvider>
			<TrashPage />
		</AdminNavProvider>
	);
}

function TrashPage() {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const list = useEntryList("trash");
	const { state } = list;
	return (
		<AdminShell
			editorial
			title={t("dashboard.trash")}
			count={list.data.isLoading ? undefined : list.data.total}
			sidebar={{ activeNav: "trash" }}
		>
			<PageActions>
				<EntryListHeaderActions list={list} />
			</PageActions>
			<Box width="full" maxWidth="content" centered paddingX={32} shrink={false}>
				<Tabs value={state.collection}>
					<TabsList variant="bar" inset="none" aria-label={t("dashboard.trashCollections")}>
						{site.COLLECTIONS.map((item) => (
							<TabsTrigger
								key={item}
								value={item}
								nativeButton={false}
								render={<Link href={site.adminHref(`/trash?collection=${item}`)} />}
							>
								{site.COLLECTION_DEFINITIONS[item].label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			</Box>
			<EntryListBody list={list} />
		</AdminShell>
	);
}

function ListPage() {
	const site = useSite();
	const list = useEntryList("list");
	const { state, update, folders } = list;
	const routePath = site.schemaOf(state.collection).path;
	const folderLabel =
		folders && state.folder !== "all"
			? ` · ${folders.list.find((folder) => folder.id === state.folder)?.name ?? ""}`
			: "";
	return (
		<AdminShell
			editorial
			title={`${list.label}${folderLabel}`}
			count={list.data.isLoading ? undefined : list.data.total}
			description={routePath ? <RouteDescription path={routePath} /> : undefined}
			sidebar={{
				activeNav: state.collection,
				folderNav: folders
					? {
							collection: state.collection,
							currentFolder: state.folder,
							includeDescendants: state.includeDescendants,
							folders: folders.list,
							folderActions: folders.actions,
							onSelectFolder: (folder) => update({ folder }),
							onIncludeDescendantsChange: (includeDescendants) => update({ includeDescendants }),
							onDropEntries: folders.moveEntries,
							onCreateEntry: list.createNew,
						}
					: undefined,
			}}
		>
			<PageActions>
				<EntryListHeaderActions list={list} />
			</PageActions>
			<EntryListBody list={list} />
		</AdminShell>
	);
}
