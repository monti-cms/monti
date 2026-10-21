"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { useId } from "react";
import { Badge } from "../../ui/badge.js";
import { Checkbox } from "../../ui/checkbox.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table.js";
import { importMessages } from "./messages.js";
/** The most entry rows the preview lists; the counts above them cover all. */
const ROW_LIMIT = 200;
/** Value of the "skip" choice of a collection's select. */
const SKIP = "__skip__";
/** Where each collection of the archive goes: a select of the site's document collections, or skip. */
function CollectionTargets({ preview, form }) {
    const t = useTranslator(importMessages);
    const items = [
        { value: SKIP, label: t("collections.skip") },
        ...preview.targets.map((target) => ({ value: target.name, label: target.label })),
    ];
    return (_jsxs("section", { className: "flex flex-col gap-2", "aria-label": t("collections.title"), "data-testid": "import-collections", children: [_jsx("h4", { className: "font-medium text-sm", children: t("collections.title") }), _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: t("collections.archive") }), _jsx(TableHead, { children: t("collections.target") })] }) }), _jsx(TableBody, { children: preview.collections.map((collection) => {
                            const name = collection.name === "" ? t("collections.top") : collection.name;
                            return (_jsxs(TableRow, { children: [_jsxs(TableCell, { className: "align-top", children: [_jsx("div", { className: "font-medium", children: name }), _jsx("div", { className: "text-monti-muted-foreground text-xs", children: t("collections.count", { count: collection.entries }) })] }), _jsxs(TableCell, { className: "whitespace-normal", children: [_jsxs(Select, { value: collection.target ?? SKIP, items: items, onValueChange: (value) => form.setTarget(collection.name, value && value !== SKIP ? value : null), children: [_jsx(SelectTrigger, { size: "sm", "aria-label": `${t("collections.target")}: ${name}`, children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: items.map((item) => (_jsx(SelectItem, { value: item.value, children: item.label }, item.value))) })] }), collection.skipped && (_jsx("p", { className: "mt-1 text-monti-muted-foreground text-xs leading-relaxed", children: collection.skipped.text }))] })] }, collection.name));
                        }) })] })] }));
}
function EntryStatus({ entry }) {
    const t = useTranslator(importMessages);
    if (!entry.skipped) {
        return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx(Badge, { variant: "success", children: t("entries.willImport") }), entry.notes.map((note) => (_jsx("span", { className: "text-monti-muted-foreground text-xs leading-relaxed", children: note.text }, note.code)))] }));
    }
    const conflict = entry.skipped.code === "slug_exists";
    return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx(Badge, { variant: conflict ? "warning" : "secondary", children: conflict ? t("entries.conflict") : t("entries.skipped") }), _jsx("span", { className: "text-monti-muted-foreground text-xs leading-relaxed", children: entry.skipped.text })] }));
}
function EntryRows({ preview }) {
    const t = useTranslator(importMessages);
    const site = useSite();
    const rows = preview.entries.slice(0, ROW_LIMIT);
    // The collection an entry goes to; when it goes nowhere, the collection it came from.
    const placeOf = (entry) => entry.target === null
        ? entry.collection === ""
            ? t("collections.top")
            : entry.collection
        : (preview.targets.find((target) => target.name === entry.target)?.label ?? entry.target);
    return (_jsxs("section", { className: "flex flex-col gap-2", "aria-label": t("entries.title"), "data-testid": "import-entries", children: [_jsx("h4", { className: "font-medium text-sm", children: t("entries.title") }), _jsx("div", { className: "max-h-96 overflow-y-auto rounded-md border", children: _jsxs(Table, { containerClassName: "overflow-visible", children: [_jsx(TableHeader, { className: "sticky top-0 bg-monti-card", children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: t("entries.title.column") }), _jsx(TableHead, { children: t("entries.locale") }), _jsx(TableHead, { children: t("entries.collection") }), _jsx(TableHead, { children: t("entries.result") })] }) }), _jsx(TableBody, { children: rows.map((entry) => (_jsxs(TableRow, { "data-testid": "import-entry", "data-status": entry.skipped ? "skipped" : "import", children: [_jsxs(TableCell, { className: "max-w-64 whitespace-normal align-top", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-x-2 gap-y-1", children: [_jsx("span", { className: "break-words font-medium", children: entry.title ?? t("entries.noTitle") }), entry.isTranslation && _jsx(Badge, { variant: "outline", children: t("entries.translation") })] }), _jsx("div", { className: "break-all font-mono text-monti-muted-foreground text-xs", children: entry.slug ?? "—" }), entry.body !== null && (_jsx("div", { className: "text-monti-muted-foreground text-xs", children: entry.body.kind === "text" ? t("body.text", { format: entry.body.format }) : t("body.json") }))] }), _jsx(TableCell, { className: "align-top", children: site.localeLabel(entry.locale) }), _jsx(TableCell, { className: "align-top", children: placeOf(entry) }), _jsx(TableCell, { className: "whitespace-normal align-top", children: _jsx(EntryStatus, { entry: entry }) })] }, entry.key))) })] }) }), preview.entries.length > ROW_LIMIT && (_jsx("p", { className: "text-monti-muted-foreground text-xs", children: t("entries.more", { count: preview.entries.length - ROW_LIMIT }) }))] }));
}
/** What the import leaves behind or cannot keep, in plain lines: values not read, images outside the media library, links to entries that are not imported. */
function Leftovers({ preview }) {
    const t = useTranslator(importMessages);
    const { counts } = preview;
    return (_jsxs("section", { className: "flex flex-col gap-2", "aria-label": t("fields.title"), "data-testid": "import-leftovers", children: [_jsx("h4", { className: "font-medium text-sm", children: t("fields.title") }), _jsxs("ul", { className: "flex flex-col gap-1.5 text-monti-muted-foreground text-sm leading-relaxed", children: [_jsx("li", { children: t("fields.only") }), preview.kind === "export" && _jsx("li", { children: t("fields.shared") }), preview.fieldsNotImported.map((item) => (_jsxs("li", { "data-testid": "import-fields", children: [t("fields.line", {
                                collection: item.collection === "" ? t("collections.top") : item.collection,
                                fields: item.fields.join(", "),
                            }), item.required.length > 0 && (_jsx("span", { className: "block text-xs", children: t("fields.required", { collection: item.target, fields: item.required.join(", ") }) }))] }, item.collection))), counts.outsideImages > 0 && (_jsx("li", { "data-testid": "import-images", children: t("images.line", { count: counts.outsideImages }) })), counts.keptLinks > 0 && _jsx("li", { "data-testid": "import-links", children: t("links.line", { count: counts.keptLinks }) })] })] }));
}
/** The archive as the server reads it: the counts, where each collection goes, every entry and what happens to it, and what is left behind. */
export function PreviewView({ preview, form }) {
    const t = useTranslator(importMessages);
    const publishId = useId();
    const { counts } = preview;
    return (_jsxs("div", { className: "flex flex-col gap-6", "data-testid": "import-preview", children: [_jsxs("p", { className: "flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm", "data-testid": "import-summary", children: [_jsx("span", { className: "font-medium text-base", children: t("summary.found", { count: counts.entries }) }), _jsx("span", { className: "text-monti-muted-foreground", children: [
                            t("summary.import", { count: counts.imported }),
                            t("summary.skipped", { count: counts.skipped }),
                            counts.conflicts > 0 ? t("summary.conflicts", { count: counts.conflicts }) : null,
                            preview.kind === "markdown" && counts.otherFiles > 0
                                ? t("summary.files", { count: counts.otherFiles })
                                : null,
                        ]
                            .filter(Boolean)
                            .join(" · ") })] }), _jsx(CollectionTargets, { preview: preview, form: form }), _jsx(EntryRows, { preview: preview }), _jsx(Leftovers, { preview: preview }), counts.publishable > 0 && (_jsxs("label", { htmlFor: publishId, className: "flex cursor-pointer items-start gap-3 text-sm", children: [_jsx(Checkbox, { id: publishId, checked: form.publish, onCheckedChange: (checked) => form.setPublish(checked === true), className: "mt-0.5" }), _jsxs("span", { className: "flex flex-col gap-0.5", children: [_jsx("span", { className: "font-medium", children: t("publish.label") }), _jsx("span", { className: "text-monti-muted-foreground text-xs leading-relaxed", children: t("publish.hint", { count: counts.publishable }) })] })] }))] }));
}
