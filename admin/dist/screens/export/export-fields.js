"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { useId } from "react";
import { errorText } from "../../api/client.js";
import { cn } from "../../lib/utils/cn.js";
import { Button } from "../../ui/button.js";
import { Checkbox } from "../../ui/checkbox.js";
import { Spinner } from "../../ui/spinner.js";
import { LoadErrorAlert } from "../shared/load-error-alert.js";
import { exportMessages } from "./messages.js";
const SCOPES = ["admin", "public"];
/**
 * What the archive would hold, said in counts. For a selection it leads with the entries and the translations that come with them
 * ("3 post entries + 2 translations"); for the whole site it lists every kind. It says what was left out, and why.
 */
function SummaryView({ summary, selection, noun }) {
    const t = useTranslator(exportMessages);
    const asked = summary.entries - summary.addedByTranslations;
    const stats = [
        ...(selection ? [] : [["count.entries", summary.entries]]),
        ...(summary.scope === "admin" && !selection
            ? [["count.templates", summary.templates]]
            : []),
        ...(summary.scope === "admin" ? [["count.folders", summary.folders]] : []),
        ...(summary.scope === "admin" ? [["count.addresses", summary.addresses]] : []),
        ["count.media", summary.media],
    ];
    return (_jsxs("div", { className: "flex flex-col gap-3", "data-testid": "export-summary", children: [selection && (_jsx("p", { className: "font-medium text-base", "data-testid": "export-headline", children: summary.entries === 0
                    ? t("summary.empty")
                    : [
                        asked > 0 ? t("summary.entries", { count: asked, noun }) : null,
                        summary.addedByTranslations > 0
                            ? t("summary.translations", { count: summary.addedByTranslations })
                            : null,
                    ]
                        .filter(Boolean)
                        .join(" + ") })), _jsx("dl", { className: "grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3", children: stats.map(([key, count]) => (_jsxs("div", { className: "flex items-baseline justify-between gap-3 border-b py-1.5 text-sm", children: [_jsx("dt", { className: "text-monti-muted-foreground", children: t(key) }), _jsx("dd", { className: "font-medium tabular-nums", children: count })] }, key))) }), _jsxs("ul", { className: "flex flex-col gap-1 text-monti-muted-foreground text-xs leading-relaxed", children: [selection && summary.addedByTranslations > 0 && _jsx("li", { children: t("note.translations") }), selection && summary.scope === "admin" && _jsx("li", { children: t("note.selection") }), summary.notPublished > 0 && _jsx("li", { children: t("note.notPublished", { count: summary.notPublished }) }), summary.notFound > 0 && _jsx("li", { children: t("note.notFound", { count: summary.notFound }) }), _jsx("li", { children: t("note.media") })] })] }));
}
/**
 * The choices and counts of an export, one component for the card and both dialogs: the counts first (they follow the scope), then the scope, then the files.
 * JSON is always in; each text format the server lists is a checkbox. `noun` is the label of the collection the selected entries belong to.
 */
export function ExportFields({ form, selection = false, noun = "", }) {
    const t = useTranslator(exportMessages);
    const site = useSite();
    const scopeName = useId();
    const formatId = useId();
    const { summary, summaryQuery, formats, formatsQuery } = form;
    const busy = form.isExporting;
    return (_jsxs("div", { className: "flex flex-col gap-6", children: [_jsx("section", { "aria-label": t("summary.includes"), "aria-busy": summaryQuery.isPlaceholderData, className: cn("flex flex-col gap-3 transition-opacity", summaryQuery.isPlaceholderData && "opacity-50"), children: summary ? (_jsx(SummaryView, { summary: summary, selection: selection, noun: noun })) : summaryQuery.isError ? (_jsx(LoadErrorAlert, { message: errorText(site, summaryQuery.error, t("summary.failed")), onRetry: () => void summaryQuery.refetch() })) : (_jsx("p", { className: "text-monti-muted-foreground text-sm", children: t("summary.loading") })) }), _jsxs("fieldset", { className: "flex flex-col gap-2", disabled: busy, children: [_jsx("legend", { className: "mb-1 font-medium text-sm", children: t("scope.label") }), SCOPES.map((scope) => (_jsxs("label", { className: "flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm has-disabled:cursor-not-allowed has-checked:border-monti-primary has-checked:bg-monti-primary/5 has-disabled:opacity-60", children: [_jsx("input", { type: "radio", name: scopeName, value: scope, checked: form.scope === scope, onChange: () => form.setScope(scope), className: "mt-0.5 accent-monti-primary" }), _jsxs("span", { className: "flex flex-col gap-0.5", children: [_jsx("span", { className: "font-medium", children: t(`scope.${scope}`) }), _jsx("span", { className: "text-monti-muted-foreground text-xs leading-relaxed", children: t(`scope.${scope}.hint`) })] })] }, scope)))] }), _jsxs("fieldset", { className: "flex flex-col gap-2", disabled: busy, children: [_jsx("legend", { className: "mb-1 font-medium text-sm", children: t("formats.label") }), _jsxs("div", { className: "flex items-start gap-3 text-sm", children: [_jsx(Checkbox, { checked: true, disabled: true, "aria-label": t("formats.json"), className: "mt-0.5" }), _jsxs("span", { className: "flex flex-col gap-0.5", children: [_jsx("span", { className: "font-medium", children: t("formats.json") }), _jsx("span", { className: "text-monti-muted-foreground text-xs leading-relaxed", children: t("formats.json.hint") })] })] }), formats.map((format) => (_jsxs("label", { htmlFor: `${formatId}-${format.name}`, className: "flex cursor-pointer items-start gap-3 text-sm", children: [_jsx(Checkbox, { id: `${formatId}-${format.name}`, checked: form.format === format.name, onCheckedChange: () => form.toggleFormat(format.name), "aria-label": t("formats.text", { label: format.label, extension: format.extension }), className: "mt-0.5" }), _jsxs("span", { className: "flex flex-col gap-0.5", children: [_jsx("span", { className: "font-medium", children: t("formats.text", { label: format.label, extension: format.extension }) }), _jsx("span", { className: "text-monti-muted-foreground text-xs leading-relaxed", children: t("formats.text.hint") })] })] }, format.name))), formats.length > 1 && _jsx("p", { className: "text-monti-muted-foreground text-xs", children: t("formats.one") }), formatsQuery.isSuccess && formats.length === 0 && (_jsx("p", { className: "text-monti-muted-foreground text-xs", "data-testid": "export-no-formats", children: t("formats.none") })), formatsQuery.isError && _jsx("p", { className: "text-monti-muted-foreground text-xs", children: t("formats.failed") })] })] }));
}
/** What the export is doing while it runs: building the archive, then the share of it that has come down. */
export function ExportProgressLine({ phase }) {
    const t = useTranslator(exportMessages);
    if (!phase)
        return null;
    const percent = phase.kind === "downloading" ? phase.percent : null;
    return (_jsxs("output", { className: "flex flex-col gap-1.5", "data-testid": "export-progress", children: [_jsxs("div", { className: "flex items-center gap-2 text-monti-muted-foreground text-sm", children: [_jsx(Spinner, { "aria-hidden": true, className: "size-3.5" }), phase.kind === "building"
                        ? t("progress.building")
                        : percent === null
                            ? t("progress.downloadingUnknown")
                            : t("progress.downloading", { percent })] }), _jsx("div", { className: "h-1 overflow-hidden rounded-full bg-monti-muted", children: _jsx("div", { className: percent === null
                        ? "h-full w-1/3 animate-pulse rounded-full bg-monti-primary"
                        : "h-full rounded-full bg-monti-primary transition-[width]", style: percent === null ? undefined : { width: `${percent}%` } }) })] }));
}
/** The export button of a form: disabled while it runs, and when a selection holds nothing to export. */
export function ExportButton({ form, label, selection = false, onDone, }) {
    const empty = form.summary !== undefined && selection && form.summary.entries === 0;
    return (_jsx(Button, { type: "button", disabled: form.isExporting || form.summary === undefined || form.summaryQuery.isPlaceholderData || empty, onClick: () => void form.run().then((ok) => ok && onDone?.()), children: label }));
}
