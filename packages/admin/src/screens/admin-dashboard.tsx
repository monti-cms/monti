"use client";

import type { AdminColumnSettings } from "@monti-cms/core/client";
import { adminHref, COLLECTION_DEFINITIONS, COLLECTIONS, createTranslator } from "@monti-cms/core/client";
import { FolderPlus, Plus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "../lib/utils/cn";
import { Button, buttonVariants } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { AdminEntriesTable } from "./admin-entries-table";
import { BulkBar, runBulk } from "./entries/bulk-bar";
import { toSelection } from "./list-row-menu";
import { FilterChipBar, ListSearch } from "./list-toolbar";
import { screensMessages } from "./messages";
import { RecordPanel } from "./record-panel";
import { AdminNavProvider, AdminShell } from "./shared/admin-shell";
import { SIDE_PANEL_DOCK } from "./shared/side-panel";
import { type EntryList, useEntryList } from "./use-entry-list";

const t = createTranslator(screensMessages);

/** 목록 위 오른쪽: 검색과 추가 버튼(휴지통에는 추가가 없다). */
function EntryListHeaderActions({ list }: { list: EntryList }) {
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

/** 목록 본문: 필터 칩, 일괄 작업 줄, 표, 분류 편집 패널, 그리고 목록 작업이 여는 창. */
function EntryListBody({ list }: { list: EntryList }) {
	const { state, data, mode } = list;
	const isTrash = mode === "trash";
	const { items } = data;
	const record = list.recordTarget;
	return (
		<>
			<div className="relative flex min-h-0 flex-1 overflow-hidden">
				<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
					<FilterChipBar state={state} options={list.options} onChange={list.update} />
					<BulkBar
						collection={state.collection}
						mode={mode}
						selected={items.filter((item) => list.selectedIds.has(item.id)).map(toSelection)}
						folders={data.folders}
						onClearSelection={() => list.setSelectedIds(new Set())}
						onRun={(op, targets, params) =>
							list.mutations.mutateEntries(op, targets, () => runBulk(op, targets, params), params)
						}
					/>
					<AdminEntriesTable
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
						folderActions={isTrash ? undefined : list.folderActions}
						rowMenu={list.rowMenu}
						blankMenu={
							isTrash
								? undefined
								: [
										{
											kind: "item",
											label: state.folder === "all" ? t("list.folderAdd") : t("list.folderAddChild"),
											icon: FolderPlus,
											onSelect: () => list.folderActions.requestCreate(state.folder === "all" ? null : state.folder),
										},
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
					/>
				</div>
				{record && (
					<RecordPanel
						key={`${record.collection}:${record.id ?? "new"}`}
						target={record}
						className={SIDE_PANEL_DOCK}
						onDirtyChange={list.setRecordDirty}
						onClose={list.closeRecord}
						onSaved={(saved) => {
							// 저장한 항목을 그대로 열어 둔다. 새 항목이면 만든 항목의 편집으로 바뀐다.
							if (!record.id) list.showRecord({ collection: record.collection, id: saved.id });
							toast.success(t("common.saved"));
							void list.invalidateEntries();
							list.reloadTaxonomies();
						}}
					/>
				)}
			</div>
			{list.folderActions.dialogs}
			{list.confirmDialog}
		</>
	);
}

// 관리자 목록은 브라우저에서 데이터를 가져온다. hydration 뒤에 그려야 Base UI의 자동 ID가 서버 HTML과 어긋나지 않는다.
function useDashboardMounted() {
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	return mounted;
}

/** 첫 화면을 그리기 전 자리 표시. 사이드바·머리·목록 줄 모양을 흉내 낸다. */
function DashboardLoading() {
	return (
		<div aria-busy="true" className="flex h-svh overflow-hidden">
			<span className="sr-only">{t("dashboard.loading")}</span>
			<div aria-hidden className="hidden w-64 shrink-0 space-y-2 border-r p-3 md:block">
				<Skeleton className="mb-4 h-7 w-32" />
				{Array.from({ length: 6 }, (_, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: 자리표시
					<Skeleton key={index} className="h-7 w-full" />
				))}
			</div>
			<div aria-hidden className="flex min-w-0 flex-1 flex-col">
				<div className="flex h-13 shrink-0 items-center justify-between border-b px-4 lg:px-5">
					<Skeleton className="h-5 w-32" />
					<Skeleton className="h-8 w-64" />
				</div>
				<div className="space-y-3 px-5 py-4">
					{Array.from({ length: 8 }, (_, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: 자리표시
						<Skeleton key={index} className="h-7 w-full" />
					))}
				</div>
			</div>
		</div>
	);
}

/** 목록 화면(§3.1·§3.2). 별도 통계 대시보드 없이 컬렉션 목록을 연다. */
export function AdminClientDashboard() {
	const mounted = useDashboardMounted();
	if (!mounted) return <DashboardLoading />;

	return (
		<AdminNavProvider>
			<ListPage />
		</AdminNavProvider>
	);
}

/** 휴지통 전용 화면(v2 A3). 컬렉션 탭으로 나누고 복원·영구 삭제만 제공한다. */
export function AdminTrashDashboard() {
	const mounted = useDashboardMounted();
	if (!mounted) return <DashboardLoading />;

	return (
		<AdminNavProvider>
			<TrashPage />
		</AdminNavProvider>
	);
}

function TrashPage() {
	const list = useEntryList("trash");
	const { state } = list;
	return (
		<AdminShell
			title={t("dashboard.trash")}
			count={list.data.total}
			sidebar={{ activeNav: "trash" }}
			headerActions={
				<>
					<EntryListHeaderActions list={list} />
					<nav
						aria-label={t("dashboard.trashCollections")}
						className="flex items-center gap-1 rounded-lg bg-cms-muted p-[3px]"
					>
						{COLLECTIONS.map((item) => (
							<Link
								key={item}
								href={adminHref(`/trash?collection=${item}`) as Route}
								aria-current={state.collection === item ? "page" : undefined}
								className={cn(
									buttonVariants({ variant: "ghost", size: "xs" }),
									"text-cms-muted-foreground aria-[current=page]:bg-cms-background aria-[current=page]:text-cms-foreground aria-[current=page]:shadow-sm",
								)}
							>
								{COLLECTION_DEFINITIONS[item].label}
							</Link>
						))}
					</nav>
				</>
			}
		>
			<EntryListBody list={list} />
		</AdminShell>
	);
}

function ListPage() {
	const list = useEntryList("list");
	const { state, update } = list;
	const { folders } = list.data;
	const folderLabel =
		state.folder !== "all" ? ` · ${folders.find((folder) => folder.id === state.folder)?.name ?? ""}` : "";
	return (
		<AdminShell
			title={`${list.label}${folderLabel}`}
			count={list.data.total}
			headerActions={<EntryListHeaderActions list={list} />}
			sidebar={{
				activeNav: state.collection,
				folderNav: {
					collection: state.collection,
					currentFolder: state.folder,
					includeDescendants: state.includeDescendants,
					folders,
					folderActions: list.folderActions,
					onSelectFolder: (folder) => update({ folder }),
					onIncludeDescendantsChange: (includeDescendants) => update({ includeDescendants }),
					onDropEntries: list.moveEntries,
					onCreateEntry: list.createNew,
				},
			}}
		>
			<EntryListBody list={list} />
		</AdminShell>
	);
}
