"use client";

import type { AdminColumnSettings } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { Box, Button, Inline, PageTabs, Skeleton, Stack, Tabs, TabsTrigger, Text } from "@monti-cms/ui";
import { FolderPlus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { commonMessages } from "../lib/common.messages";
import { AdminLink as Link } from "../router";
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
	return (
		<>
			<Inline position="relative" align="stretch" gap="none" grow minHeight={0} overflow="hidden">
				<Stack gap="none" grow minWidth={0} overflow="hidden">
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
				</Stack>
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

/** Placeholder before the first render, in the places and sizes of the sidebar, the list header, its tabs and table, so nothing jumps. */
function ListLoading() {
	const tc = useTranslator(commonMessages);
	return (
		<Inline align="stretch" gap="none" height="screen" overflow="clip" aria-busy="true">
			<Text srOnly>{tc("loading")}</Text>
			<Stack
				gap="condensed"
				width="sidebar"
				shrink={false}
				border="right"
				background="inset"
				padding="condensed"
				hideBelow="md"
				aria-hidden
			>
				<Skeleton shape="control-sm" width="medium" />
				<Stack gap="tight" paddingTop="normal">
					{PLACEHOLDER_ROWS.map((row) => (
						<Skeleton key={row} shape="control-sm" />
					))}
				</Stack>
			</Stack>
			<Stack gap="none" grow minWidth={0} aria-hidden>
				<Box width="full" maxWidth="content" centered paddingX="wide" paddingTop="spacious">
					{/* The title bar: title and address on the left, search and the add button on the right. */}
					<Inline justify="between" gap="normal" shrink={false} border="bottom-strong" paddingBottom="normal">
						<Inline gap="condensed">
							<Skeleton shape="line" width="short" />
							<Skeleton shape="line" width="medium" />
						</Inline>
						<Inline gap="condensed">
							<Skeleton shape="control-sm" width="medium" />
							<Skeleton shape="control-sm" width="short" />
						</Inline>
					</Inline>
					{/* Status tabs. */}
					<Inline gap="comfortable" shrink={false} border="bottom" paddingY="condensed">
						<Skeleton shape="line" width="chip" />
						<Skeleton shape="line" width="chip" />
						<Skeleton shape="line" width="chip" />
						<Skeleton shape="line" width="chip" />
					</Inline>
					{/* Editorial index rows. */}
					<Stack gap="none">
						{PLACEHOLDER_ROWS.slice(0, 6).map((row) => (
							<Inline key={row} justify="between" gap="spacious" border="bottom" paddingY="comfortable">
								<Stack gap="tight" grow>
									<Skeleton shape="line" width="third" />
									<Skeleton shape="line" width="short" />
								</Stack>
								<Inline gap="normal">
									<Skeleton shape="line" width="chip" />
									<Skeleton shape="line" width="short" />
								</Inline>
							</Inline>
						))}
					</Stack>
				</Box>
			</Stack>
		</Inline>
	);
}

const PLACEHOLDER_ROWS = Array.from({ length: 8 }, (_, index) => index);

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
			<Box width="full" maxWidth="content" centered paddingX="wide" shrink={false}>
				<Tabs value={state.collection}>
					<PageTabs inset="none" aria-label={t("dashboard.trashCollections")}>
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
					</PageTabs>
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
