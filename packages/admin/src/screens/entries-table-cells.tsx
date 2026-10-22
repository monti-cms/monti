// Cell renderers of the entries table: title, status label, locale badges, dates, slug, folder and field columns.

import type { Folder, ListEntriesItem, ListTranslationMember } from "@monti-cms/core/site";
import { type Site, useSite, useTranslator } from "@monti-cms/core/site";
import { Badge, Box, Inline, StatusIndicator, Text, TextLink } from "@monti-cms/ui";
import { Folder as FolderIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useAdminComponents } from "../admin-components";
import { commonMessages } from "../lib/common.messages";
import { AdminLink as Link } from "../router";
import { customListCell, DefaultFieldCell } from "./list-cells";
import { type AdminListColumn, fieldColumnOf } from "./list-columns";
import { screensMessages } from "./messages";
import { describeEntryStatus, statusLabels } from "./shared/entry-status";
import { entryStatusMarker } from "./shared/entry-status-marker";
import { formatDateOnly, formatDateTime, zonedYear } from "./shared/format-date";

/** List date: this year as "Sep 27 14:05" (in the admin language), otherwise short like `2025. 8. 7.`. The exact time is in the edit screen, not a tooltip. */
const formatDate = (site: Site, value: Date | string | null) => {
	if (!value) return "—";
	const sameYear = zonedYear(site, value) === zonedYear(site, Date.now());
	return sameYear
		? formatDateTime(site, value, { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
		: formatDateOnly(site, value);
};

/** Per-locale status of a translation group. Existing locales link to their edit screen; missing ones show only as dashed. Status is also readable as text, not just color. */
function LocaleBadges({ translations }: { translations: readonly ListTranslationMember[] }) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	return (
		<Inline as="span" gap="tight">
			{site.LOCALES.map((locale) => {
				const name = site.localeLabel(locale);
				const member = translations.find((candidate) => candidate.locale === locale);
				if (!member) {
					return (
						// design-system: needs a dashed variant on Badge (a locale that does not exist yet)
						<Badge key={locale} variant="outline" mono>
							<span aria-hidden="true">{locale.toUpperCase()}</span>
							<Text srOnly>{t("locale.hasNot", { name })}</Text>
						</Badge>
					);
				}
				const variant =
					member.status === "published" && !member.hasUnpublishedChanges
						? "success"
						: member.status === "published" || member.status === "draft"
							? "warning"
							: "secondary";
				return (
					<Badge key={locale} variant={variant} mono render={<Link href={site.adminEntryEditHref(member.id)} />}>
						<span aria-hidden="true">{locale.toUpperCase()}</span>
						<Text srOnly>
							{name} · {statusLabels(site)[member.status]}
						</Text>
					</Badge>
				);
			})}
		</Inline>
	);
}

/** Locales of a taxonomy item (category, tag, series). Locales with a name are filled badges, others are dashed badges. */
function RecordLocaleBadges({ locales }: { locales: readonly string[] }) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	return (
		<Inline as="span" gap="tight">
			{site.LOCALES.map((locale) => {
				const named = locales.includes(locale);
				return (
					// design-system: needs a dashed variant on Badge (a locale that does not exist yet)
					<Badge key={locale} variant={named ? "success" : "outline"} mono>
						<span aria-hidden="true">{locale.toUpperCase()}</span>
						<Text srOnly>{t(named ? "locale.has" : "locale.hasNot", { name: site.localeLabel(locale) })}</Text>
					</Badge>
				);
			})}
		</Inline>
	);
}

/** Shows status with both icon shape and text (not conveyed by color alone). */
function StatusLabel({ item, isRecord }: { item: ListEntriesItem; isRecord: boolean }) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const label = isRecord && item.status === "published" ? t("list.statusActive") : describeEntryStatus(site, item);
	return <StatusIndicator {...entryStatusMarker(item.status, item.hasUnpublishedChanges)} label={label} />;
}

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
			const title = item.title || <Text tone="muted">{tc("untitled")}</Text>;
			// Like the code names of the field list: the slug in mono, small and muted beside the title. It truncates first.
			const slug =
				showSlugBesideTitle && item.slug ? (
					<Box minWidth={0}>
						<Text as="div" variant="caption" tone="muted" mono truncate>
							{item.slug}
						</Text>
					</Box>
				) : null;
			// The title does not shrink (it truncates only at the full width), so the slug beside it gives way first.
			const titleBox = (content: ReactNode) => (
				<Box maxWidth="full" shrink={false}>
					<Text as="div" weight="medium" truncate>
						{content}
					</Text>
				</Box>
			);
			if (isTrash)
				return (
					<Inline align="baseline" gap="condensed" minWidth={0}>
						{titleBox(title)}
						{slug}
					</Inline>
				);
			return isRecord ? (
				<Inline align="baseline" gap="condensed" minWidth={0}>
					{titleBox(
						<TextLink underline="hover" render={<button type="button" onClick={() => onOpenRecord(item)} />}>
							{title}
						</TextLink>,
					)}
					{slug}
				</Inline>
			) : (
				<Inline align="baseline" gap="condensed" minWidth={0}>
					{titleBox(
						<TextLink underline="hover" render={<Link href={site.adminEntryEditHref(item.id)} />}>
							{title}
						</TextLink>,
					)}
					{slug}
					{showFolderBesideTitle && item.folderId && (
						<Inline gap="tight" minWidth={0}>
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
		case "status":
			// Do not convey status by color alone.
			return <StatusLabel item={item} isRecord={isRecord} />;
		case "locale":
			if (item.recordLocales) return <RecordLocaleBadges locales={item.recordLocales} />;
			if (item.translations) return <LocaleBadges translations={item.translations} />;
			// Also mark that a translation is not the original.
			return (
				<Inline as="span" gap="tight">
					<Text variant="caption" tone="muted" weight="medium">
						<abbr title={site.localeLabel(item.locale)}>{item.locale.toUpperCase()}</abbr>
					</Text>
					{item.translationGroupId !== item.id && (
						<Text variant="caption" tone="muted">
							{t("list.translation")}
						</Text>
					)}
				</Inline>
			);
		case "updatedAt":
		case "createdAt":
		case "publishedAt":
			return (
				<Text variant="caption" tone="muted">
					{formatDate(site, item[column])}
				</Text>
			);
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
