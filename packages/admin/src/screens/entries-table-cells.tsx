// Cell renderers of the entries table: title, status label, locale badges, dates, slug, folder and field columns.

import type { Folder, ListEntriesItem, ListTranslationMember } from "@monti-cms/core/site";
import { type Site, useSite, useTranslator } from "@monti-cms/core/site";
import { Folder as FolderIcon } from "lucide-react";
import { useAdminComponents } from "../admin-components";
import { commonMessages } from "../lib/common.messages";
import { cn } from "../lib/utils/cn";
import { AdminLink as Link } from "../router";
import { Badge, badgeVariants } from "../ui/badge";
import { Button } from "../ui/button";
import { StatusIndicator } from "../ui/status-indicator";
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
		<span className="flex items-center gap-1">
			{site.LOCALES.map((locale) => {
				const name = site.localeLabel(locale);
				const member = translations.find((candidate) => candidate.locale === locale);
				if (!member) {
					return (
						<Badge
							key={locale}
							variant="outline"
							className="border-dashed font-mono text-monti-micro text-monti-muted-foreground/70"
						>
							<span aria-hidden="true">{locale.toUpperCase()}</span>
							<span className="sr-only">{t("locale.hasNot", { name })}</span>
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
					<Link
						key={locale}
						href={site.adminEntryEditHref(member.id)}
						className={cn(badgeVariants({ variant }), "font-mono text-monti-micro")}
					>
						<span aria-hidden="true">{locale.toUpperCase()}</span>
						<span className="sr-only">
							{name} · {statusLabels(site)[member.status]}
						</span>
					</Link>
				);
			})}
		</span>
	);
}

/** Locales of a taxonomy item (category, tag, series). Locales with a name are filled badges, others are dashed badges. */
function RecordLocaleBadges({ locales }: { locales: readonly string[] }) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	return (
		<span className="flex items-center gap-1">
			{site.LOCALES.map((locale) => {
				const named = locales.includes(locale);
				return (
					<Badge
						key={locale}
						variant={named ? "success" : "outline"}
						className={cn("font-mono text-monti-micro", !named && "border-dashed text-monti-muted-foreground/70")}
					>
						<span aria-hidden="true">{locale.toUpperCase()}</span>
						<span className="sr-only">
							{t(named ? "locale.has" : "locale.hasNot", { name: site.localeLabel(locale) })}
						</span>
					</Badge>
				);
			})}
		</span>
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
			const title = item.title || <span className="text-monti-muted-foreground italic">{tc("untitled")}</span>;
			// Like the code names of the field list: the slug in mono, small and muted beside the title. It truncates first.
			const slug =
				showSlugBesideTitle && item.slug ? (
					<span className="min-w-0 shrink-[5] truncate font-mono text-monti-caption text-monti-muted-foreground">
						{item.slug}
					</span>
				) : null;
			// The title does not shrink (it truncates only at the full width), so the slug beside it gives way first.
			const titleClass = "max-w-full shrink-0 truncate font-medium text-monti-body";
			if (isTrash)
				return (
					<span className="flex min-w-0 items-baseline gap-2">
						<span className={titleClass}>{title}</span>
						{slug}
					</span>
				);
			return isRecord ? (
				<span className="flex min-w-0 items-baseline gap-2">
					<Button
						type="button"
						variant="link"
						size="sm"
						onClick={() => onOpenRecord(item)}
						className="h-auto max-w-full shrink-0 p-0 font-medium text-monti-body text-monti-foreground hover:underline"
					>
						<span className="truncate">{title}</span>
					</Button>
					{slug}
				</span>
			) : (
				<span className="flex min-w-0 items-baseline gap-2">
					<Link
						href={site.adminEntryEditHref(item.id)}
						className={cn(titleClass, "text-monti-foreground hover:underline")}
					>
						{title}
					</Link>
					{slug}
					{showFolderBesideTitle && item.folderId && (
						<span className="flex min-w-0 shrink items-center gap-1 text-monti-caption text-monti-muted-foreground">
							<FolderIcon aria-hidden className="size-3 shrink-0 self-center" />
							<span className="truncate">
								<span className="sr-only">{t("list.folderSr")}</span>
								{folderName(folders, item.folderId)}
							</span>
						</span>
					)}
				</span>
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
				<span className="text-monti-caption text-monti-muted-foreground">
					<abbr title={site.localeLabel(item.locale)} className="font-medium no-underline">
						{item.locale.toUpperCase()}
					</abbr>
					{item.translationGroupId !== item.id && <span className="ml-1">{t("list.translation")}</span>}
				</span>
			);
		case "updatedAt":
		case "createdAt":
		case "publishedAt":
			return (
				<span className="whitespace-nowrap text-monti-caption text-monti-muted-foreground tabular-nums">
					{formatDate(site, item[column])}
				</span>
			);
		case "slug":
			return <span className="font-mono text-monti-caption text-monti-muted-foreground">{item.slug || "—"}</span>;
		case "folder":
			return (
				<span className="text-monti-caption text-monti-muted-foreground">{folderName(folders, item.folderId)}</span>
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
