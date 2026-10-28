"use client";

import type { Folder, ListEntriesItem, ListSortField } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { Count, EntryStatus, Inline, RowActions, RowCheck, TableCell, Text, TextButton } from "@monti-cms/ui";
import type { ReactNode } from "react";
import { useAdminComponents } from "../admin-components";
import { commonMessages } from "../lib/common.messages";
import { EntryCell } from "./entries-table-cells";
import { customListCell } from "./list-cells";
import { type AdminListColumn, fieldColumnOf } from "./list-columns";
import { shortDate } from "./list-row-dates";
import { screensMessages } from "./messages";
import { type MenuAction, MoreActionsButton } from "./shared/action-menu";
import { entryStatusKind, statusLabels } from "./shared/entry-status";

/**
 * Column widths of a row, in px. They are the design system's grid (`44 · 1fr · 190 · 48 · 64 · 48 · 16`) plus the 8px each cell adds to the 12px the board
 * leaves between columns, so the title gets what the board gives it. The ⋯ cell holds its 32px button and the cell's padding.
 */
const SIZE = {
	month: 52,
	taxonomy: 198,
	locale: 56,
	status: 72,
	date: 56,
	field: 160,
	slug: 160,
	folder: 140,
	actions: 54,
} as const;

/** The widths of the cells after the title, in order, for the columns of a row: the taxonomy fields are one cell. Rows that are not entries (folders) draw empty cells of these widths, so every row keeps the same columns. */
export function cellSizesOf(taxonomy: ReadonlySet<string>, columns: readonly AdminListColumn[]): number[] {
	const sizes: number[] = [];
	let taxonomyDrawn = false;
	for (const column of columns) {
		if (taxonomy.has(column)) {
			if (!taxonomyDrawn) sizes.push(SIZE.taxonomy);
			taxonomyDrawn = true;
		} else if (column === "locale") sizes.push(SIZE.locale);
		else if (column === "status") sizes.push(SIZE.status);
		else if (DATE_COLUMNS.includes(column)) sizes.push(SIZE.date);
		else sizes.push(column === "slug" ? SIZE.slug : column === "folder" ? SIZE.folder : SIZE.field);
	}
	return sizes;
}

/** The widths of the first and the last cell of a row: the month with the check, and the ⋯. */
export const ROW_ENDS = { start: SIZE.month, end: SIZE.actions } as const;

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

/** Only what is not plainly published says where the entry stands: a published entry is the quiet normal case. */
function StatusCell({ item }: { item: ListEntriesItem }) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const kind = entryStatusKind(item.status, item.hasUnpublishedChanges);
	if (kind === "published" || item.status === "trashed") return null;
	return (
		<EntryStatus status={kind}>
			{kind === "editing" ? t("filter.editing") : statusLabels(site)[item.status]}
		</EntryStatus>
	);
}

/**
 * The cells of one row, in the order of the board: the month and the row check, the title with its address on one line, the columns the writer turned on in
 * the View menu (the taxonomy fields drawn together as "Dev · React"), and the ⋯ at the end. The row's own wrapper (menu, drag, selection) is the caller's.
 */
export function EntryRowCells({
	collection,
	item,
	columns,
	monthMark,
	sortField,
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
	/** The columns to draw after the title, in order: the visible ones the page has room for. */
	columns: readonly AdminListColumn[];
	monthMark: string | null;
	sortField: ListSortField;
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
	const taxonomy = new Set(site.taxonomyFieldsOf(collection).map((stored) => stored.name));
	const taxonomyNames = columns
		.filter((column) => taxonomy.has(column))
		.flatMap((column) => (item.relations[column] ?? []).flatMap(({ title }) => (title ? [title] : [])));
	let taxonomyDrawn = false;
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
	const cell = (column: AdminListColumn): ReactNode => {
		// A cell an extension registered (for a field or a system column) takes the place of the default one.
		const custom = customListCell(site, listCells, collection, column);
		if (!custom && taxonomy.has(column)) {
			// The taxonomy fields are one cell, at the place of the first one.
			if (taxonomyDrawn) return null;
			taxonomyDrawn = true;
			return (
				<TableCell key="taxonomy" size={SIZE.taxonomy} tone="subtle" title={taxonomyNames.join(" · ")}>
					<Text as="div" truncate>
						{taxonomyNames.join(" · ")}
					</Text>
				</TableCell>
			);
		}
		if (!custom && column === "locale") {
			return (
				<TableCell key={column} size={SIZE.locale}>
					<LanguageCell item={item} />
				</TableCell>
			);
		}
		if (!custom && column === "status") {
			return (
				<TableCell key={column} size={SIZE.status}>
					{!isTrash && <StatusCell item={item} />}
				</TableCell>
			);
		}
		if (!custom && DATE_COLUMNS.includes(column)) {
			return (
				<TableCell key={column} size={SIZE.date} align="end">
					<Text as="span" mono variant="meta" tone="muted">
						{shortDate(site, item[column as "updatedAt" | "createdAt" | "publishedAt"])}
					</Text>
				</TableCell>
			);
		}
		const other = (
			<EntryCell
				collection={collection}
				column={column}
				item={item}
				folders={folders}
				isTrash={isTrash}
				isRecord={isRecord}
				showFolderBesideTitle={false}
				showSlugBesideTitle={false}
				onOpenRecord={onOpenRecord}
			/>
		);
		return (
			<TableCell
				key={column}
				size={column === "slug" ? SIZE.slug : column === "folder" ? SIZE.folder : SIZE.field}
				tone="subtle"
			>
				{custom || hasValue(column) ? (
					<Text as="div" truncate>
						{other}
					</Text>
				) : null}
			</TableCell>
		);
	};
	return (
		<>
			<TableCell size={SIZE.month}>
				<RowCheck
					checked={selected}
					onCheckedChange={onSelect}
					label={t("list.rowSelect", { title: item.title ?? tc("untitled") })}
				/>
				{sortField !== "title" && sortField !== "slug" && monthMark && <Count>{monthMark}</Count>}
			</TableCell>
			<TableCell>
				<EntryCell
					collection={collection}
					column="title"
					item={item}
					folders={folders}
					isTrash={isTrash}
					isRecord={isRecord}
					showFolderBesideTitle={showFolderBesideTitle}
					showSlugBesideTitle={showSlugBesideTitle}
					onOpenRecord={onOpenRecord}
				/>
			</TableCell>
			{columns.map(cell)}
			<TableCell size={isTrash ? undefined : SIZE.actions} align="end">
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
