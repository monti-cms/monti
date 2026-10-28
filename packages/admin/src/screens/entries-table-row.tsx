"use client";

import type { Folder, ListEntriesItem } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { Count, EntryStatus, Inline, RowActions, RowCheck, TableCell, Text, TextButton } from "@monti-cms/ui";
import type { ReactNode } from "react";
import { useAdminComponents } from "../admin-components";
import { commonMessages } from "../lib/common.messages";
import { EntryCell } from "./entries-table-cells";
import { ACTIONS_SIZE, columnSize } from "./entries-table-widths";
import { customListCell } from "./list-cells";
import { type AdminListColumn, fieldColumnOf } from "./list-columns";
import { shortDate } from "./list-row-dates";
import { screensMessages } from "./messages";
import { type MenuAction, MoreActionsButton } from "./shared/action-menu";
import { entryStatusKind, statusLabels } from "./shared/entry-status";

const DATE_COLUMNS: readonly AdminListColumn[] = ["updatedAt", "createdAt", "publishedAt"];

/** A language as the list says it: its code in mono, and "+1" for each other language the entry has. */
function LanguageCell({ item }: { item: ListEntriesItem }) {
	const site = useSite();
	const named = item.recordLocales ?? item.translations?.map((member) => member.locale);
	const codes = named && named.length > 0 ? site.LOCALES.filter((locale) => named.includes(locale)) : [item.locale];
	const [first = item.locale, ...others] = codes;
	return (
		<Count title={codes.map((code) => site.localeLabel(code)).join(", ")}>
			{first.toUpperCase()}
			{others.length > 0 && ` +${others.length}`}
		</Count>
	);
}

/** Where the entry stands, every status named: a published entry, the usual case, in the quiet tone, so the column is never blank. */
function StatusCell({ item }: { item: ListEntriesItem }) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const kind = entryStatusKind(item.status, item.hasUnpublishedChanges);
	return (
		<EntryStatus status={kind} quiet={kind === "published"}>
			{kind === "editing" ? t("filter.editing") : statusLabels(site)[item.status]}
		</EntryStatus>
	);
}

/**
 * The cells of one row, in the order of the list's columns (the title is one of them), and the ⋯ at the end. The row's check hangs off its first cell.
 * The row's own wrapper (menu, drag, selection) is the caller's.
 */
export function EntryRowCells({
	collection,
	item,
	columns,
	folders,
	isTrash,
	isRecord,
	showFolderBesideTitle,
	showSlugBesideTitle,
	selected,
	onSelect,
	menu,
	onOpenRecord,
	onRestore,
	onPermanentDelete,
}: {
	collection: string;
	item: ListEntriesItem;
	/** The columns to draw, in order: the visible ones the page has room for. */
	columns: readonly AdminListColumn[];
	folders: Folder[];
	isTrash: boolean;
	isRecord: boolean;
	showFolderBesideTitle: boolean;
	showSlugBesideTitle: boolean;
	selected: boolean;
	onSelect: (selected: boolean) => void;
	menu: MenuAction[];
	onOpenRecord: (item: ListEntriesItem) => void;
	onRestore?: (item: ListEntriesItem) => void;
	onPermanentDelete?: (item: ListEntriesItem) => void;
}) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const tc = useTranslator(commonMessages);
	const { listCells } = useAdminComponents();
	/** Whether a column has anything to draw for this row: an empty cell stays (the columns line up) and says nothing. */
	const hasValue = (column: AdminListColumn): boolean => {
		if (column === "slug") return Boolean(item.slug);
		if (column === "folder")
			return Boolean(item.folderId && folders.some((candidate) => candidate.id === item.folderId));
		const stored = fieldColumnOf(site, collection, column);
		if (!stored) return false;
		return stored.field.kind === "relation"
			? (item.relations[column] ?? []).some(({ title }) => Boolean(title))
			: Boolean(item.values[column]);
	};
	const content = (column: AdminListColumn): ReactNode => {
		// A cell an extension registered (for a field or a system column) takes the place of the default one.
		const custom = customListCell(site, listCells, collection, column);
		if (!custom && column === "locale") return <LanguageCell item={item} />;
		if (!custom && column === "status") return isTrash ? null : <StatusCell item={item} />;
		if (!custom && DATE_COLUMNS.includes(column)) {
			return (
				<Text as="span" mono variant="meta" tone="muted">
					{shortDate(site, item[column as "updatedAt" | "createdAt" | "publishedAt"])}
				</Text>
			);
		}
		const value = (
			<EntryCell
				collection={collection}
				column={column}
				item={item}
				folders={folders}
				isTrash={isTrash}
				isRecord={isRecord}
				showFolderBesideTitle={column === "title" && showFolderBesideTitle}
				showSlugBesideTitle={column === "title" && showSlugBesideTitle}
				onOpenRecord={onOpenRecord}
			/>
		);
		if (column === "title") return value;
		return custom || hasValue(column) ? (
			<Text as="div" truncate>
				{value}
			</Text>
		) : null;
	};
	return (
		<>
			{columns.map((column, index) => (
				<TableCell
					key={column}
					size={columnSize(site, collection, column)}
					align={DATE_COLUMNS.includes(column) ? "end" : "start"}
					tone={column === "title" || column === "status" || column === "locale" ? undefined : "subtle"}
				>
					{index === 0 && (
						<RowCheck
							checked={selected}
							onCheckedChange={onSelect}
							label={t("list.rowSelect", { title: item.title ?? tc("untitled") })}
						/>
					)}
					{content(column)}
				</TableCell>
			))}
			<TableCell size={isTrash ? undefined : ACTIONS_SIZE} align="end">
				<Inline gap={4} justify="end">
					{isTrash && (
						<>
							<TextButton type="button" onClick={() => onRestore?.(item)}>
								{tc("lifecycle.restore")}
							</TextButton>
							<TextButton type="button" variant="danger" onClick={() => onPermanentDelete?.(item)}>
								{tc("lifecycle.deletePermanently")}
							</TextButton>
						</>
					)}
					<RowActions>
						<MoreActionsButton actions={menu} label={t("list.rowActions", { title: item.title ?? tc("untitled") })} />
					</RowActions>
				</Inline>
			</TableCell>
		</>
	);
}
