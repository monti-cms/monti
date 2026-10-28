"use client";

import { type PageSize, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Chip,
	PageToolbar,
	PageToolbarEnd,
	type SelectAllState,
	Tabs,
	TabsList,
	TabsTrigger,
	TextButton,
} from "@monti-cms/ui";
import type { AdminListColumn } from "./list-columns";
import { ListFilterMenu } from "./list-filter-menu";
import { filterChipsOf } from "./list-filter-model";
import { clearFiltersPatch, type ListState } from "./list-state";
import { ListViewMenu } from "./list-view-menu";
import { screensMessages } from "./messages";
import { statusLabels } from "./shared/entry-status";
import { useFilterTitles } from "./use-filter-titles";

/** The tabs under the page title: each is one status, `all` is none, and `editing` is a published entry with changes not yet published. */
export type StatusTab = "all" | "published" | "editing" | "draft" | "archived";

const STATUS_TABS: readonly StatusTab[] = ["all", "published", "editing", "draft", "archived"];

/** The tab the state is on, or `null` for a status filter no tab says (several statuses at once, put in the address by hand). */
export function activeStatusTab(state: Pick<ListState, "statuses" | "hasChanges">): StatusTab | null {
	if (state.hasChanges) return state.statuses.length === 0 ? "editing" : null;
	if (state.statuses.length === 0) return "all";
	return state.statuses.length === 1 ? ((state.statuses[0] as StatusTab | undefined) ?? null) : null;
}

/** What picking a tab does to the state: exactly that status, and "editing" is the changes flag on its own. */
export function statusTabPatch(tab: StatusTab): Pick<ListState, "statuses" | "hasChanges"> {
	if (tab === "all") return { statuses: [], hasChanges: false };
	if (tab === "editing") return { statuses: [], hasChanges: true };
	return { statuses: [tab], hasChanges: false };
}

/**
 * The row under the page title: the status tabs (a list of documents), then the filters that are on as chips, the Filter menu and the View menu. The
 * select-all hangs in the margin. Once rows are picked the list shows the bulk bar in its place.
 */
export function ListToolbar({
	state,
	mode,
	total,
	selectAll,
	onChange,
	order,
	visibility,
	onPageSizeChange,
	onToggleColumn,
	onReorderColumn,
	onMoveColumn,
}: {
	state: ListState;
	mode: "list" | "trash";
	/** Rows the list has with these filters, shown beside the tab that is on. */
	total: number | undefined;
	selectAll: { state: SelectAllState; onChange: (all: boolean) => void; label: string };
	onChange: (patch: Partial<ListState>) => void;
	order: AdminListColumn[];
	visibility: Record<string, boolean>;
	onPageSizeChange: (size: PageSize) => void;
	onToggleColumn: (column: AdminListColumn, visible: boolean) => void;
	onReorderColumn: (from: AdminListColumn, to: AdminListColumn) => void;
	onMoveColumn: (column: AdminListColumn, direction: -1 | 1) => void;
}) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const titles = useFilterTitles(state);
	const chips = filterChipsOf(site, state, titles);
	const hasTabs = mode === "list" && site.isDocumentCollection(state.collection);
	const active = activeStatusTab(state);
	const names: Record<StatusTab, string> = {
		all: t("list.statusAll"),
		editing: t("filter.editing"),
		...statusLabels(site),
	};
	return (
		<PageToolbar inset selectAll={selectAll}>
			{hasTabs && (
				<Tabs value={active ?? ""} onValueChange={(tab) => onChange(statusTabPatch(tab as StatusTab))}>
					<TabsList variant="toolbar" aria-label={t("list.statusFilter")}>
						{STATUS_TABS.map((tab) => (
							<TabsTrigger key={tab} value={tab} count={tab === active ? total : undefined}>
								{names[tab]}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			)}
			<PageToolbarEnd>
				{chips.map((chip) => (
					<Chip
						key={chip.key}
						onRemove={() => onChange(chip.clear)}
						removeLabel={t("listMenu.chipRemove", { label: chip.label })}
					>
						{chip.label}
					</Chip>
				))}
				{chips.length >= 2 && (
					<TextButton type="button" variant="quiet" onClick={() => onChange(clearFiltersPatch(state))}>
						{t("filter.clearAll")}
					</TextButton>
				)}
				<ListFilterMenu state={state} onChange={onChange} />
				<ListViewMenu
					state={state}
					order={order}
					visibility={visibility}
					onChange={onChange}
					onPageSizeChange={onPageSizeChange}
					onToggleColumn={onToggleColumn}
					onReorderColumn={onReorderColumn}
					onMoveColumn={onMoveColumn}
				/>
			</PageToolbarEnd>
		</PageToolbar>
	);
}
