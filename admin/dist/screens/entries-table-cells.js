import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Cell renderers of the entries table: title, status label, locale badges, dates, slug, folder and field columns.
import { useSite, useTranslator } from "@monti-cms/core/client";
import { Folder as FolderIcon } from "lucide-react";
import { useCmsAdminComponents } from "../admin-components.js";
import { commonMessages } from "../lib/common.messages.js";
import { cn } from "../lib/utils/cn.js";
import { AdminLink as Link } from "../router/index.js";
import { Badge, badgeVariants } from "../ui/badge.js";
import { Button } from "../ui/button.js";
import { StatusIndicator } from "../ui/status-indicator.js";
import { customListCell, DefaultFieldCell } from "./list-cells.js";
import { fieldColumnOf } from "./list-columns.js";
import { screensMessages } from "./messages.js";
import { describeEntryStatus, statusLabels } from "./shared/entry-status.js";
import { formatDateOnly, formatDateTime, zonedYear } from "./shared/format-date.js";
/** List date: this year as "Sep 27 14:05" (in the admin language), otherwise short like `2025. 8. 7.`. The exact time is in the edit screen, not a tooltip. */
const formatDate = (site, value) => {
    if (!value)
        return "—";
    const sameYear = zonedYear(site, value) === zonedYear(site, Date.now());
    return sameYear
        ? formatDateTime(site, value, { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
        : formatDateOnly(site, value);
};
/** Per-locale status of a translation group. Existing locales link to their edit screen; missing ones show only as dashed. Status is also readable as text, not just color. */
function LocaleBadges({ translations }) {
    const site = useSite();
    const t = useTranslator(screensMessages);
    return (_jsx("span", { className: "flex items-center gap-1", children: site.LOCALES.map((locale) => {
            const name = site.localeLabel(locale);
            const member = translations.find((candidate) => candidate.locale === locale);
            if (!member) {
                return (_jsxs(Badge, { variant: "outline", className: "border-dashed text-cms-muted-foreground/70", children: [_jsx("span", { "aria-hidden": "true", children: locale.toUpperCase() }), _jsx("span", { className: "sr-only", children: t("locale.hasNot", { name }) })] }, locale));
            }
            const variant = member.status === "published" && !member.hasUnpublishedChanges
                ? "success"
                : member.status === "published" || member.status === "draft"
                    ? "warning"
                    : "secondary";
            return (_jsxs(Link, { href: site.adminEntryEditHref(member.id), className: badgeVariants({ variant }), children: [_jsx("span", { "aria-hidden": "true", children: locale.toUpperCase() }), _jsxs("span", { className: "sr-only", children: [name, " \u00B7 ", statusLabels(site)[member.status]] })] }, locale));
        }) }));
}
/** Locales of a taxonomy item (category, tag, series). Locales with a name are filled badges, others are dashed badges. */
function RecordLocaleBadges({ locales }) {
    const site = useSite();
    const t = useTranslator(screensMessages);
    return (_jsx("span", { className: "flex items-center gap-1", children: site.LOCALES.map((locale) => {
            const named = locales.includes(locale);
            return (_jsxs(Badge, { variant: named ? "success" : "outline", className: cn(!named && "border-dashed text-cms-muted-foreground/70"), children: [_jsx("span", { "aria-hidden": "true", children: locale.toUpperCase() }), _jsx("span", { className: "sr-only", children: t(named ? "locale.has" : "locale.hasNot", { name: site.localeLabel(locale) }) })] }, locale));
        }) }));
}
/** Shows status with both icon shape and text (not conveyed by color alone). */
function StatusLabel({ item, isRecord }) {
    const site = useSite();
    const t = useTranslator(screensMessages);
    const label = isRecord && item.status === "published" ? t("list.statusActive") : describeEntryStatus(site, item);
    const published = item.status === "published";
    const gone = item.status === "archived" || item.status === "trashed";
    return (_jsx(StatusIndicator, { tone: published ? (item.hasUnpublishedChanges ? "warning" : "success") : "neutral", shape: published ? (item.hasUnpublishedChanges ? "half" : "dot") : gone ? "minus" : "dashed", label: label }));
}
/** Folder path from the top level, like `Parent / Child`. `—` for items outside folders. */
const folderName = (folders, id) => {
    const names = [];
    let folder = id ? folders.find((candidate) => candidate.id === id) : undefined;
    while (folder && names.length < 8) {
        names.unshift(folder.name);
        const parentId = folder.parentId;
        folder = parentId ? folders.find((candidate) => candidate.id === parentId) : undefined;
    }
    return names.length > 0 ? names.join(" / ") : "—";
};
function DefaultEntryCell({ collection, column, item, folders, isTrash, isRecord, showFolderBesideTitle, onOpenRecord, }) {
    const site = useSite();
    const t = useTranslator(screensMessages);
    const tc = useTranslator(commonMessages);
    switch (column) {
        case "title": {
            const title = item.title || _jsx("span", { className: "text-cms-muted-foreground italic", children: tc("untitled") });
            if (isTrash)
                return _jsx("span", { className: "font-medium", children: title });
            return isRecord ? (_jsx(Button, { type: "button", variant: "link", size: "sm", onClick: () => onOpenRecord(item), className: "h-auto p-0 font-medium text-cms-foreground hover:text-cms-primary", children: title })) : (_jsxs("span", { className: "flex min-w-0 items-center gap-2", children: [_jsx(Link, { href: site.adminEntryEditHref(item.id), className: "truncate font-medium text-cms-foreground hover:text-cms-primary", children: title }), showFolderBesideTitle && item.folderId && (_jsxs("span", { className: "flex min-w-0 shrink items-center gap-1 text-cms-muted-foreground text-xs", children: [_jsx(FolderIcon, { "aria-hidden": true, className: "size-3 shrink-0" }), _jsxs("span", { className: "truncate", children: [_jsx("span", { className: "sr-only", children: t("list.folderSr") }), folderName(folders, item.folderId)] })] }))] }));
        }
        case "status":
            // Do not convey status by color alone.
            return _jsx(StatusLabel, { item: item, isRecord: isRecord });
        case "locale":
            if (item.recordLocales)
                return _jsx(RecordLocaleBadges, { locales: item.recordLocales });
            if (item.translations)
                return _jsx(LocaleBadges, { translations: item.translations });
            // Also mark that a translation is not the original.
            return (_jsxs("span", { className: "text-cms-muted-foreground text-xs", children: [_jsx("abbr", { title: site.localeLabel(item.locale), className: "font-medium no-underline", children: item.locale.toUpperCase() }), item.translationGroupId !== item.id && _jsx("span", { className: "ml-1", children: t("list.translation") })] }));
        case "updatedAt":
        case "createdAt":
        case "publishedAt":
            return (_jsx("span", { className: "tabular whitespace-nowrap text-cms-muted-foreground text-xs", children: formatDate(site, item[column]) }));
        case "slug":
            return _jsx("span", { className: "font-mono text-cms-muted-foreground text-xs", children: item.slug || "—" });
        case "folder":
            return _jsx("span", { className: "text-cms-muted-foreground text-xs", children: folderName(folders, item.folderId) });
        default:
            // Field columns: default cells for relations (including taxonomy fields), select and text.
            return _jsx(DefaultFieldCell, { collection: collection, column: column, entry: item });
    }
}
/** One cell of the entries table. Cells registered by admin extensions (`listCells`) take precedence over default cells. */
export function EntryCell(props) {
    const site = useSite();
    const { listCells } = useCmsAdminComponents();
    const { collection, column, item } = props;
    const Custom = customListCell(site, listCells, collection, column);
    if (!Custom)
        return _jsx(DefaultEntryCell, { ...props });
    const stored = fieldColumnOf(site, collection, column);
    return (_jsx(Custom, { collection: collection, column: column, field: stored?.field, entry: item, value: stored ? item.values[column] : undefined }));
}
