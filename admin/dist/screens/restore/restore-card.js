"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { useRef } from "react";
import { errorText } from "../../api/client.js";
import { Alert, AlertDescription } from "../../ui/alert.js";
import { Button } from "../../ui/button.js";
import { Spinner } from "../../ui/spinner.js";
import { useConfirm } from "../shared/confirm-dialog.js";
import { LoadErrorAlert } from "../shared/load-error-alert.js";
import { restoreMessages } from "./messages.js";
import { useRestoreBackup } from "./use-restore-backup.js";
/** The most problems, warnings and skipped templates listed; the counts above them cover all. */
const LIST_LIMIT = 50;
const STATUSES = ["draft", "published", "archived", "trashed"];
const formatBytes = (bytes) => bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024))} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
/** What a restore holds, in plain lines. */
function CountLines({ counts }) {
    const t = useTranslator(restoreMessages);
    const statuses = STATUSES.filter((status) => (counts.byStatus[status] ?? 0) > 0).map((status) => t(`summary.${status}`, { count: counts.byStatus[status] ?? 0 }));
    return (_jsxs("div", { className: "flex flex-col gap-1.5 text-sm", "data-testid": "restore-counts", children: [_jsx("p", { className: "font-medium text-base", children: t("summary.entries", { count: counts.entries }) }), _jsxs("ul", { className: "flex list-disc flex-col gap-1 pl-5 text-monti-muted-foreground", children: [statuses.length > 0 && _jsx("li", { children: statuses.join(" · ") }), counts.translations > 0 && _jsx("li", { children: t("summary.translations", { count: counts.translations }) }), _jsx("li", { children: t("summary.folders", { count: counts.folders }) }), _jsx("li", { children: t("summary.media", { count: counts.media }) }), _jsx("li", { children: t("summary.addresses", { count: counts.addresses, aliases: counts.aliases }) }), _jsx("li", { children: t("summary.templates", { added: counts.templatesAdded, skipped: counts.templatesSkipped.length }) })] }), counts.templatesSkipped.length > 0 && (_jsxs("div", { className: "mt-1 flex flex-col gap-1", "data-testid": "restore-templates", children: [_jsx("p", { className: "font-medium", children: t("templates.title") }), _jsx("ul", { className: "flex flex-col gap-0.5 text-monti-muted-foreground text-xs leading-relaxed", children: counts.templatesSkipped.slice(0, LIST_LIMIT).map((template) => (_jsxs("li", { children: [_jsx("span", { className: "font-medium", children: template.name }), ": ", template.text] }, template.id))) })] }))] }));
}
/** Every problem that stops the restore, with what it is about and what the check found. */
function Problems({ preview }) {
    const t = useTranslator(restoreMessages);
    const shown = preview.problems.slice(0, LIST_LIMIT);
    return (_jsxs("section", { className: "flex flex-col gap-2", "aria-label": t("problems.title"), "data-testid": "restore-problems", children: [_jsx("h4", { className: "font-medium text-monti-destructive text-sm", children: t("problems.title") }), _jsx("p", { className: "text-monti-muted-foreground text-xs", children: t("problems.hint") }), _jsx("ul", { className: "flex max-h-96 flex-col gap-2 overflow-y-auto rounded-md border px-3 py-2", children: shown.map((problem, index) => (_jsxs("li", { className: "flex flex-col gap-0.5 border-b pb-2 text-sm last:border-b-0 last:pb-0", "data-testid": "restore-problem", "data-code": problem.code, children: [_jsx("span", { className: "font-medium", children: problem.label ?? problem.id ?? t("problems.archive") }), _jsx("span", { className: "text-monti-muted-foreground text-xs leading-relaxed", children: problem.text }), problem.found.map((line) => (_jsx("span", { className: "text-monti-muted-foreground text-xs leading-relaxed", children: line }, line)))] }, index))) }), preview.problems.length > LIST_LIMIT && (_jsx("p", { className: "text-monti-muted-foreground text-xs", children: t("problems.more", { count: preview.problems.length - LIST_LIMIT }) }))] }));
}
function Warnings({ warnings }) {
    const t = useTranslator(restoreMessages);
    if (warnings.length === 0)
        return null;
    return (_jsxs("section", { className: "flex flex-col gap-2", "aria-label": t("warnings.title"), "data-testid": "restore-warnings", children: [_jsx("h4", { className: "font-medium text-sm", children: t("warnings.title") }), _jsx("ul", { className: "flex flex-col gap-1 text-monti-muted-foreground text-xs leading-relaxed", children: warnings.slice(0, LIST_LIMIT).map((warning) => (_jsxs("li", { children: [warning.label && _jsxs("span", { className: "font-medium", children: [warning.label, " "] }), warning.text] }, `${warning.code}:${warning.id ?? ""}`))) }), warnings.length > LIST_LIMIT && (_jsx("p", { className: "text-monti-muted-foreground text-xs", children: t("warnings.more", { count: warnings.length - LIST_LIMIT }) }))] }));
}
function NotRestored({ items }) {
    const t = useTranslator(restoreMessages);
    return (_jsxs("section", { className: "flex flex-col gap-2", "aria-label": t("notRestored.title"), "data-testid": "restore-not-restored", children: [_jsx("h4", { className: "font-medium text-sm", children: t("notRestored.title") }), _jsx("p", { className: "text-monti-muted-foreground text-xs", children: t("notRestored.hint") }), _jsx("ul", { className: "flex list-disc flex-col gap-1 pl-5 text-monti-muted-foreground text-xs leading-relaxed", children: items.map((item) => (_jsx("li", { children: item.text }, item.code))) })] }));
}
/** What the run is doing: the server writes everything in one step and answers when it is done, so the bar does not claim a percentage. */
function RunProgress({ count }) {
    const t = useTranslator(restoreMessages);
    return (_jsxs("output", { className: "flex flex-col gap-1.5", "data-testid": "restore-progress", children: [_jsxs("div", { className: "flex items-center gap-2 text-monti-muted-foreground text-sm", children: [_jsx(Spinner, { "aria-hidden": true, className: "size-3.5" }), t("progress.running", { count })] }), _jsx("div", { className: "h-1 overflow-hidden rounded-full bg-monti-muted", children: _jsx("div", { className: "h-full w-1/3 animate-pulse rounded-full bg-monti-primary" }) }), _jsx("p", { className: "text-monti-muted-foreground text-xs", children: t("progress.hint") })] }));
}
function PreviewView({ preview }) {
    return (_jsx("div", { className: "flex flex-col gap-6", "data-testid": "restore-preview", children: preview.isBackup ? (_jsxs(_Fragment, { children: [_jsx(CountLines, { counts: preview.counts }), preview.problems.length > 0 && _jsx(Problems, { preview: preview }), _jsx(Warnings, { warnings: preview.warnings }), _jsx(NotRestored, { items: preview.notRestored })] })) : (_jsx(Alert, { variant: "destructive", layout: "stack", "data-testid": "restore-refusal", children: _jsxs(AlertDescription, { children: [preview.refusal?.text, preview.refusal?.fix ? ` ${preview.refusal.fix}` : ""] }) })) }));
}
function ResultView({ form }) {
    const t = useTranslator(restoreMessages);
    const site = useSite();
    const result = form.result;
    if (!result)
        return null;
    return (_jsxs("div", { className: "flex flex-col gap-6", "data-testid": "restore-result", children: [_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("h4", { className: "font-medium text-base", children: t("result.title") }), _jsx("p", { className: "text-monti-muted-foreground text-sm", children: t("result.summary", { count: result.counts.entries }) })] }), _jsx(CountLines, { counts: result.counts }), _jsx(Warnings, { warnings: result.warnings }), _jsx(NotRestored, { items: result.notRestored }), _jsx("div", { children: _jsx("a", { href: site.adminHref(), className: "text-monti-primary text-sm underline-offset-4 hover:underline", "data-testid": "restore-open", children: t("result.open") }) })] }));
}
/**
 * The body of the Restore backup card: choose a backup zip, read what restoring it would do (the preview: counts, problems, warnings, what is not
 * restored), confirm, and restore. On a site that is not empty the card is disabled and says so.
 */
export function RestoreBackupFields() {
    const t = useTranslator(restoreMessages);
    const site = useSite();
    const form = useRestoreBackup();
    const { confirm, dialog } = useConfirm();
    const input = useRef(null);
    const { preview, previewQuery, result } = form;
    const running = form.isRunning;
    const disabled = !form.empty && !result;
    if (disabled) {
        return (_jsxs("div", { className: "flex flex-col gap-1.5", "data-testid": "restore-disabled", children: [_jsx("p", { className: "font-medium text-sm", children: t("notEmpty.title") }), _jsx("p", { className: "text-monti-muted-foreground text-xs leading-relaxed", children: t("notEmpty.description") }), _jsx("div", { children: _jsx(Button, { type: "button", variant: "outline", disabled: true, "aria-disabled": true, children: t("file.choose") }) })] }));
    }
    const restore = async () => {
        if (!preview)
            return;
        const ok = await confirm({
            title: t("confirm.title"),
            description: t("confirm.description", { count: preview.counts.entries }),
            confirmLabel: t("confirm.confirm"),
            destructive: true,
        });
        if (ok)
            form.start();
    };
    return (_jsxs("div", { className: "flex flex-col gap-6", children: [!result && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("p", { className: "font-medium text-sm", children: t("kinds.label") }), _jsx("ul", { className: "flex list-disc flex-col gap-1 pl-5 text-monti-muted-foreground text-xs leading-relaxed", children: _jsx("li", { children: t("kinds.backup") }) })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx("input", { ref: input, type: "file", accept: ".zip,application/zip", className: "sr-only", "aria-label": t("file.choose"), "data-testid": "restore-file", disabled: running, onChange: (event) => {
                                    const picked = event.target.files?.[0];
                                    if (picked)
                                        form.chooseFile(picked);
                                    // The same file chosen again must still fire a change.
                                    event.target.value = "";
                                } }), _jsx(Button, { type: "button", variant: "outline", disabled: running, onClick: () => input.current?.click(), children: form.file ? t("file.change") : t("file.choose") }), form.file && (_jsx("span", { className: "min-w-0 truncate text-monti-muted-foreground text-sm", children: form.file.name }))] }), form.tooLarge && form.limit !== undefined && (_jsx(Alert, { variant: "destructive", layout: "stack", children: _jsx(AlertDescription, { children: t("file.tooLarge", { limit: formatBytes(form.limit) }) }) })), form.file && !form.tooLarge && !preview && previewQuery.isPending && (_jsx("p", { className: "text-monti-muted-foreground text-sm", children: t("preview.loading") })), previewQuery.isError && (_jsx(LoadErrorAlert, { message: errorText(site, previewQuery.error, t("preview.failed")), onRetry: () => void previewQuery.refetch() })), preview && _jsx(PreviewView, { preview: preview }), Boolean(form.runError) && (_jsx(Alert, { variant: "destructive", layout: "stack", "data-testid": "restore-error", children: _jsx(AlertDescription, { children: errorText(site, form.runError, t("error.run")) }) })), running && preview && _jsx(RunProgress, { count: preview.counts.entries }), preview && (_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Button, { type: "button", disabled: running || !preview.ready, onClick: () => void restore(), "data-testid": "restore-run", children: t("action.restore") }), _jsx(Button, { type: "button", variant: "ghost", disabled: running, onClick: form.reset, children: t("action.cancel") })] }))] })), result && _jsx(ResultView, { form: form }), dialog] }));
}
