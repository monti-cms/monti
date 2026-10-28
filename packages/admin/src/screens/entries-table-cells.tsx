// Cell renderers of the entries table: title, status label, locale badges, dates, slug, folder and field columns.

import { Folder as FolderIcon } from "@carbon/icons-react";
import type { Folder, ListEntriesItem } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { Box, Inline, RowLink, Text } from "@monti-cms/ui";
import type { ReactNode } from "react";
import { useAdminComponents } from "../admin-components";
import { commonMessages } from "../lib/common.messages";
import { AdminLink as Link } from "../router";
import { customListCell, DefaultFieldCell } from "./list-cells";
import { type AdminListColumn, fieldColumnOf } from "./list-columns";
import { screensMessages } from "./messages";

/** Folder path from the top level, like `Parent / Child`. `—` for items outside folders. */
const folderName = (folders: readonly Folder[], id: string | null) => {
	const names: string[] = [];
	let folder = id ? folders.find((candidate) => candidate.id === id) : undefined;
	while (folder && names.length < 8) {
		names.unshift(folder.name);
		const parentId = folder.parentId;
		folder = parentId ? folders.find((candidate) => candidate.id === parentId) : undefined;
	}
	return names.length > 0 ? names.join(" / ") : "—";
};

interface EntryCellProps {
	collection: string;
	column: AdminListColumn;
	item: ListEntriesItem;
	folders: Folder[];
	isTrash: boolean;
	isRecord: boolean;
	/** Append the folder path small next to the title (flat view with the folder column off). */
	showFolderBesideTitle: boolean;
	/** Append the slug small after the title (the slug column is off). */
	showSlugBesideTitle: boolean;
	onOpenRecord: (item: ListEntriesItem) => void;
}

function DefaultEntryCell({
	collection,
	column,
	item,
	folders,
	isTrash,
	isRecord,
	showFolderBesideTitle,
	showSlugBesideTitle,
	onOpenRecord,
}: EntryCellProps) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const tc = useTranslator(commonMessages);
	switch (column) {
		case "title": {
			const title = item.title || (
				<Text tone="muted" italic>
					{tc("untitled")}
				</Text>
			);
			// Like the code names of the field list: the slug in mono, small and muted beside the title. It truncates first.
			const formattedSlug = item.slug ? (item.slug.startsWith("/") ? item.slug : `/${item.slug}`) : "";
			const slug =
				showSlugBesideTitle && formattedSlug ? (
					<Box minWidth={0}>
						<Text as="div" variant="meta" tone="faint" mono truncate>
							{formattedSlug}
						</Text>
					</Box>
				) : null;
			// The title does not shrink (it truncates only at the full width), so the slug beside it gives way first.
			const titleBox = (content: ReactNode) => (
				<Box maxWidth="full" shrink={false}>
					<Text as="div" truncate>
						{content}
					</Text>
				</Box>
			);
			if (isTrash)
				return (
					<Inline align="baseline" gap={8} minWidth={0}>
						{titleBox(title)}
						{slug}
					</Inline>
				);
			return isRecord ? (
				<Inline align="baseline" gap={8} minWidth={0}>
					{titleBox(<RowLink render={<button type="button" onClick={() => onOpenRecord(item)} />}>{title}</RowLink>)}
					{slug}
				</Inline>
			) : (
				<Inline align="baseline" gap={8} minWidth={0}>
					{titleBox(<RowLink render={<Link href={site.adminEntryEditHref(item.id)} />}>{title}</RowLink>)}
					{slug}
					{showFolderBesideTitle && item.folderId && (
						<Inline gap={4} minWidth={0}>
							<FolderIcon aria-hidden size={12} />
							<Text as="div" variant="caption" tone="muted" truncate>
								<Text srOnly>{t("list.folderSr")}</Text>
								{folderName(folders, item.folderId)}
							</Text>
						</Inline>
					)}
				</Inline>
			);
		}
		case "slug":
			return (
				<Text variant="caption" tone="muted" mono>
					{item.slug || "—"}
				</Text>
			);
		case "folder":
			return (
				<Text variant="caption" tone="muted">
					{folderName(folders, item.folderId)}
				</Text>
			);
		default:
			// Field columns: default cells for relations (including taxonomy fields), select and text.
			return <DefaultFieldCell collection={collection} column={column} entry={item} />;
	}
}

/** One cell of the entries table. Cells registered by admin extensions (`listCells`) take precedence over default cells. */
export function EntryCell(props: EntryCellProps) {
	const site = useSite();
	const { listCells } = useAdminComponents();
	const { collection, column, item } = props;
	const Custom = customListCell(site, listCells, collection, column);
	if (!Custom) return <DefaultEntryCell {...props} />;
	const stored = fieldColumnOf(site, collection, column);
	return (
		<Custom
			collection={collection}
			column={column}
			field={stored?.field}
			entry={item}
			value={stored ? item.values[column] : undefined}
		/>
	);
}
