"use client";

import type { AdminColumnSettings } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { FolderPlus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { commonMessages } from "../lib/common.messages";
import { cn } from "../lib/utils/cn";
import { AdminLink as Link } from "../router";
import { Button, buttonVariants } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { AdminEntriesTable } from "./admin-entries-table";
import { BulkBar } from "./entries/bulk-bar";
import { toSelection } from "./list-row-menu";
import { ListSearch } from "./list-toolbar";
import { screensMessages } from "./messages";
import { RecordPanel } from "./record-panel";
import { AdminNavProvider, AdminShell, PageActions } from "./shared/admin-shell";
import { DockedPanel, RECORD_PANEL_RESIZE } from "./shared/side-panel";
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
					<Plus aria-hidden />
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
			{t("list.publicAt")} <code className="font-mono text-monti-caption text-monti-default">{path}</code>
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
	return (
		<>
			<div className="relative flex min-h-0 flex-1 overflow-hidden">
				<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
					<AdminEntriesTable
						aboveTable={
							<BulkBar
								collection={state.collection}
								mode={mode}
								selected={items.filter((item) => list.selectedIds.has(item.id)).map(toSelection)}
								folders={folders?.list ?? null}
								onClearSelection={() => list.setSelectedIds(new Set())}
								onRun={(op, targets, params) => list.mutations.run(op, targets, params)}
							/>
						}
						collectionLabel={list.label}
						collection={state.collection}
						items={items}
						folders={data.folders}
						explorer={list.explorer}
						state={state}
						options={list.options}
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
														icon: FolderPlus,
														onSelect: () => folders.actions.requestCreate(state.folder === "all" ? null : state.folder),
													},
												]
											: []),
										{ kind: "item", label: t("list.add", { label: list.label }), icon: Plus, onSelect: list.createNew },
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
				</div>
				{record && (
					<DockedPanel resize={RECORD_PANEL_RESIZE}>
						<RecordPanel
							key={`${record.collection}:${record.id ?? "new"}`}
							target={record}
							onDirtyChange={list.setRecordDirty}
							onClose={list.closeRecord}
							onSaved={(saved) => {
								// Keep the saved item open as is. For a new item, switch to editing the created item.
								if (!record.id) list.showRecord({ collection: record.collection, id: saved.id });
								toast.success(tc("saved"));
								void list.invalidateEntries();
								list.reloadTaxonomies();
							}}
						/>
					</DockedPanel>
				)}
			</div>
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

/** Placeholder before the first render. Mimics the shape of the sidebar, header and list rows. */
function ListLoading() {
	const tc = useTranslator(commonMessages);
	return (
		<div aria-busy="true" className="flex h-svh overflow-hidden">
			<span className="sr-only">{tc("loading")}</span>
			<div aria-hidden className="hidden w-64 shrink-0 space-y-2 border-r p-3 md:block">
				<Skeleton className="mb-4 h-7 w-32" />
				{Array.from({ length: 6 }, (_, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: placeholder
					<Skeleton key={index} className="h-7 w-full" />
				))}
			</div>
			<div aria-hidden className="flex min-w-0 flex-1 flex-col">
				<div className="flex h-13 shrink-0 items-center justify-between border-b px-4 lg:px-4">
					<Skeleton className="h-5 w-32" />
					<Skeleton className="h-8 w-64" />
				</div>
				<div className="space-y-3 px-4 py-4">
					{Array.from({ length: 8 }, (_, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: placeholder
						<Skeleton key={index} className="h-7 w-full" />
					))}
				</div>
			</div>
		</div>
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
			title={t("dashboard.trash")}
			count={list.data.isLoading ? undefined : list.data.total}
			sidebar={{ activeNav: "trash" }}
			large
		>
			<PageActions>
				<EntryListHeaderActions list={list} />
				<nav
					aria-label={t("dashboard.trashCollections")}
					className="flex items-center gap-1 rounded-lg bg-monti-neutral p-[3px]"
				>
					{site.COLLECTIONS.map((item) => (
						<Link
							key={item}
							href={site.adminHref(`/trash?collection=${item}`)}
							aria-current={state.collection === item ? "page" : undefined}
							className={cn(
								buttonVariants({ variant: "ghost", size: "xs" }),
								"text-monti-muted aria-[current=page]:bg-monti-page aria-[current=page]:text-monti-default",
							)}
						>
							{site.COLLECTION_DEFINITIONS[item].label}
						</Link>
					))}
				</nav>
			</PageActions>
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
			title={`${list.label}${folderLabel}`}
			count={list.data.isLoading ? undefined : list.data.total}
			large
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
