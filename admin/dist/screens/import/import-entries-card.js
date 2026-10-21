"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { useRef } from "react";
import { errorText } from "../../api/client.js";
import { Alert, AlertDescription } from "../../ui/alert.js";
import { Button } from "../../ui/button.js";
import { Spinner } from "../../ui/spinner.js";
import { LoadErrorAlert } from "../shared/load-error-alert.js";
import { PreviewView } from "./import-preview.js";
import { ResultView } from "./import-result.js";
import { importMessages } from "./messages.js";
import { useImportEntries } from "./use-import-entries.js";
const formatBytes = (bytes) => bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024))} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
/** What the run is doing: the server writes drafts, then bodies, then publishes, and answers when it is done, so the bar does not claim a percentage. */
function RunProgress({ count }) {
    const t = useTranslator(importMessages);
    return (_jsxs("output", { className: "flex flex-col gap-1.5", "data-testid": "import-progress", children: [_jsxs("div", { className: "flex items-center gap-2 text-monti-muted-foreground text-sm", children: [_jsx(Spinner, { "aria-hidden": true, className: "size-3.5" }), t("progress.running", { count })] }), _jsx("div", { className: "h-1 overflow-hidden rounded-full bg-monti-muted", children: _jsx("div", { className: "h-full w-1/3 animate-pulse rounded-full bg-monti-primary" }) }), _jsx("p", { className: "text-monti-muted-foreground text-xs", children: t("progress.hint") })] }));
}
/**
 * The body of the Import entries card: choose a zip, read what it holds (the preview), pick where each collection goes, then import. The result replaces the
 * preview and links to every new entry.
 */
export function ImportEntriesFields() {
    const t = useTranslator(importMessages);
    const site = useSite();
    const form = useImportEntries();
    const input = useRef(null);
    const { preview, previewQuery, result } = form;
    const running = form.isRunning;
    return (_jsxs("div", { className: "flex flex-col gap-6", children: [_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("p", { className: "font-medium text-sm", children: t("kinds.label") }), _jsxs("ul", { className: "flex list-disc flex-col gap-1 pl-5 text-monti-muted-foreground text-xs leading-relaxed", children: [_jsx("li", { children: t("kinds.export") }), _jsx("li", { children: t("kinds.markdown") })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx("input", { ref: input, type: "file", accept: ".zip,application/zip", className: "sr-only", "aria-label": t("file.choose"), "data-testid": "import-file", disabled: running, onChange: (event) => {
                            const picked = event.target.files?.[0];
                            if (picked)
                                form.chooseFile(picked);
                            // The same file chosen again must still fire a change.
                            event.target.value = "";
                        } }), _jsx(Button, { type: "button", variant: "outline", disabled: running, onClick: () => input.current?.click(), children: form.file ? t("file.change") : t("file.choose") }), form.file && _jsx("span", { className: "min-w-0 truncate text-monti-muted-foreground text-sm", children: form.file.name })] }), form.tooLarge && form.limit !== undefined && (_jsx(Alert, { variant: "destructive", layout: "stack", children: _jsx(AlertDescription, { children: t("file.tooLarge", { limit: formatBytes(form.limit) }) }) })), form.file && !form.tooLarge && !preview && previewQuery.isPending && (_jsx("p", { className: "text-monti-muted-foreground text-sm", children: t("preview.loading") })), previewQuery.isError && (_jsx(LoadErrorAlert, { message: errorText(site, previewQuery.error, t("preview.failed")), onRetry: () => void previewQuery.refetch() })), preview && !result && (_jsx("div", { "aria-busy": previewQuery.isPlaceholderData, className: previewQuery.isPlaceholderData ? "opacity-50 transition-opacity" : "transition-opacity", children: _jsx(PreviewView, { preview: preview, form: form }) })), Boolean(form.runError) && (_jsx(Alert, { variant: "destructive", layout: "stack", children: _jsx(AlertDescription, { children: errorText(site, form.runError, t("error.run")) }) })), running && preview && _jsx(RunProgress, { count: preview.counts.imported }), preview && !result && (_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Button, { type: "button", disabled: running || previewQuery.isPlaceholderData || preview.counts.imported === 0, onClick: form.start, children: t("action.import") }), _jsx(Button, { type: "button", variant: "ghost", disabled: running, onClick: form.reset, children: t("action.cancel") }), preview.counts.imported === 0 && (_jsx("span", { className: "text-monti-muted-foreground text-xs", children: t("nothing.description") }))] })), result && (_jsxs(_Fragment, { children: [_jsx(ResultView, { result: result }), _jsx("div", { children: _jsx(Button, { type: "button", variant: "outline", onClick: form.reset, children: t("action.again") }) })] }))] }));
}
