"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AdminLink } from "../../router/index.js";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert.js";
import { Badge } from "../../ui/badge.js";
import { Button } from "../../ui/button.js";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog.js";
import { Input } from "../../ui/input.js";
import { Skeleton } from "../../ui/skeleton.js";
import { CmsApiError, errorText } from "../admin-api.js";
import { entryHref } from "../shared/entry-href.js";
import { describeChange, describeNoTransform, describeTransform } from "./change-text.js";
import { IssueList } from "./controls.js";
import { schemaMessages } from "./messages.js";
import { reloadPage } from "./reload.js";
import { previewSchema, saveSchema, } from "./schema-api.js";
/** The request of the screen's edit with the picks made so far; `undefined` picks leave the choice to the server's defaults. */
const requestOf = (draft, renames, picks) => ({
    schema: draft,
    transforms: picks ? Object.values(picks).filter((pick) => pick !== null) : undefined,
    renames,
});
const sameTransform = (a, b) => a !== null &&
    a.op === b.op &&
    JSON.stringify({ ...a, value: undefined }) === JSON.stringify({ ...b, value: undefined });
/** The choices of one change the data can follow in more than one way, each with what it does; "keep" is always there. */
function Decision({ decision, picked, onPick, }) {
    const t = useTranslator(schemaMessages);
    const site = useSite();
    const name = `decision-${decision.key}`;
    const freeText = decision.suggestions.length === 1 &&
        decision.suggestions[0]?.op === "setDefault" &&
        decision.suggestions[0].value === "";
    return (_jsxs("fieldset", { className: "flex flex-col gap-1.5 rounded-lg border p-3", "data-testid": `decision-${decision.key}`, children: [_jsx("legend", { className: "px-1 font-medium text-sm", children: describeChange(decision.change, t) }), _jsx("p", { className: "text-cms-muted-foreground text-xs", children: decision.entries === 0 ? t("review.noEntries") : t("review.entriesCount", { count: decision.entries }) }), _jsxs("label", { className: "flex items-start gap-2 text-sm", children: [_jsx("input", { type: "radio", name: name, checked: picked === null, onChange: () => onPick(null), className: "mt-1" }), _jsx("span", { children: describeNoTransform(decision.change, t) })] }), decision.suggestions.map((suggestion) => {
                const checked = sameTransform(picked, suggestion);
                return (_jsxs("label", { className: "flex flex-col gap-1 text-sm", children: [_jsxs("span", { className: "flex items-start gap-2", children: [_jsx("input", { type: "radio", name: name, checked: checked, onChange: () => onPick(suggestion), className: "mt-1" }), _jsxs("span", { children: [describeTransform(suggestion, t), suggestion.op === "dropField" && (_jsx("span", { className: "ml-1 text-cms-destructive text-xs", children: t("transform.dropWarning") }))] })] }), checked && freeText && picked?.op === "setDefault" && (_jsx(Input, { "aria-label": t("transform.defaultValue"), className: "ml-6 w-auto", value: picked.value, onChange: (event) => onPick({ ...picked, value: event.target.value }) }))] }, JSON.stringify(suggestion)));
            }), decision.sample.length > 0 && _jsx(Sample, { sample: decision.sample, entries: decision.entries, site: site })] }));
}
function Sample({ sample, entries, site, }) {
    const t = useTranslator(schemaMessages);
    return (_jsxs("div", { className: "text-xs", children: [_jsxs("span", { className: "text-cms-muted-foreground", children: [t("review.sample"), " "] }), _jsx("ul", { className: "inline", children: sample.map((entry, index) => (_jsxs("li", { className: "inline", children: [index > 0 && ", ", _jsx(AdminLink, { href: entryHref(site, entry.collection, entry.id), className: "underline underline-offset-2", target: "_blank", children: entry.title ?? entry.id.slice(0, 8) }), _jsxs("span", { className: "text-cms-muted-foreground", children: [" ", "(", entry.collection, ", ", entry.locale, ", ", entry.status, ")"] })] }, entry.id))) }), entries > sample.length && (_jsxs("span", { className: "text-cms-muted-foreground", children: [" ", t("review.more", { count: entries - sample.length })] }))] }));
}
function Impact({ impact }) {
    const t = useTranslator(schemaMessages);
    const site = useSite();
    return (_jsxs("li", { className: "flex flex-col gap-1 rounded-md border px-3 py-2", "data-testid": `impact-${impact.key}`, children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "text-sm", children: describeChange(impact.change, t) }), impact.entries > 0 && (_jsx(Badge, { variant: impact.consequence === "deleted" ? "destructive" : "secondary", children: t("review.entriesCount", { count: impact.entries }) }))] }), impact.entries > 0 && (_jsx("p", { className: "text-cms-muted-foreground text-xs", children: t(`consequence.${impact.consequence}`) })), !impact.checked && _jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("review.notChecked") }), impact.sample.length > 0 && _jsx(Sample, { sample: impact.sample, entries: impact.entries, site: site })] }));
}
/**
 * Shows what saving would do and saves it. Opening it checks the edit on the server (no write): the problems with JSON paths, the diff, the entries each change
 * touches with a sample linking to them, and a choice of data transform for every change that has more than one way to treat the stored values. Saving writes the file,
 * the types and the dev database; the screen then reloads.
 */
export function ReviewDialog({ open, onOpenChange, draft, renames, baseHash, onIssues, onSaved, onApplyFailed, }) {
    const t = useTranslator(schemaMessages);
    const site = useSite();
    const [preview, setPreview] = useState(null);
    const [picks, setPicks] = useState(undefined);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const skip = useRef(false);
    const request = (current) => ({
        schema: draft,
        transforms: current
            ? Object.values(current).filter((pick) => pick !== null)
            : undefined,
        renames,
    });
    useEffect(() => {
        if (!open) {
            setPreview(null);
            setPicks(undefined);
            setError(null);
            setSaveError(null);
            return;
        }
        if (skip.current) {
            skip.current = false;
            return;
        }
        const controller = new AbortController();
        // A pick that is being typed (a default value) is checked a moment after the last key.
        const timer = setTimeout(() => {
            setLoading(true);
            previewSchema(site, requestOf(draft, renames, picks), controller.signal)
                .then((result) => {
                setPreview(result);
                setError(null);
                onIssues(result.issues);
                if (!picks) {
                    skip.current = true;
                    setPicks(Object.fromEntries(result.decisions.map((decision) => [decision.key, decision.chosen])));
                }
            })
                .catch((reason) => {
                if (reason?.name === "AbortError")
                    return;
                setError(errorText(site, reason, t("review.loadFailed")));
            })
                .finally(() => setLoading(false));
        }, picks ? 250 : 0);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [open, draft, renames, picks, site, onIssues, t]);
    const save = async () => {
        setSaving(true);
        setSaveError(null);
        try {
            const result = await saveSchema(site, { ...request(picks), baseHash });
            if (result.saved)
                onSaved(result);
            else
                onOpenChange(false);
        }
        catch (reason) {
            if (reason instanceof CmsApiError) {
                if (reason.code === "schema_conflict")
                    setSaveError({ message: t("save.conflict"), conflict: true });
                else if (reason.code === "schema_apply_failed") {
                    setSaveError({ message: t("save.applyFailed", { message: reason.message }), applyFailed: true });
                    onApplyFailed();
                }
                else {
                    const issues = Array.isArray(reason.body.issues) ? reason.body.issues : [];
                    if (reason.code === "invalid_schema")
                        onIssues(issues);
                    setSaveError({ message: reason.message });
                }
            }
            else
                setSaveError({ message: errorText(site, reason, t("save.failed")) });
        }
        finally {
            setSaving(false);
        }
    };
    const problems = preview?.problems ?? [];
    const ready = preview?.valid && problems.length === 0 && preview.changed && !loading && !saving;
    const dataChanges = (preview?.impacts ?? []).length;
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "flex max-h-[85vh] w-[min(44rem,calc(100%-2rem))] max-w-none flex-col gap-4 sm:max-w-none", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t("review.title") }), _jsx(DialogDescription, { children: t("review.description") })] }), _jsxs("div", { className: "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1", "data-testid": "review-body", children: [error && (_jsx(Alert, { variant: "danger", layout: "stack", children: _jsx(AlertDescription, { children: error }) })), loading && !preview && _jsx(Skeleton, { className: "h-24 w-full" }), preview && !preview.valid && (_jsxs(Alert, { variant: "danger", layout: "stack", children: [_jsx(AlertTitle, { children: t("review.invalid") }), _jsx(AlertDescription, { children: _jsx(IssueList, { issues: preview.issues }) })] })), problems.length > 0 && (_jsxs(Alert, { variant: "danger", layout: "stack", children: [_jsx(AlertTitle, { children: t("review.problems") }), _jsx(AlertDescription, { children: _jsx("ul", { className: "list-disc pl-4", children: problems.map((problem) => (_jsx("li", { children: problem.message }, `${problem.id}:${problem.message}`))) }) })] })), preview?.valid && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-sm", "data-testid": "review-summary", children: preview.changed
                                        ? t("review.summary", { count: dataChanges, from: preview.currentVersion, to: preview.nextVersion })
                                        : t("review.unchanged") }), preview.baseline === "file" && (_jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("review.baselineFile") })), preview.decisions.length > 0 && (_jsxs("section", { className: "flex flex-col gap-2", "aria-label": t("review.decisions"), children: [_jsx("h3", { className: "font-medium text-sm", children: t("review.decisions") }), _jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("review.decisionsHint") }), preview.decisions.map((decision) => (_jsx(Decision, { decision: decision, picked: picks?.[decision.key] ?? null, onPick: (pick) => setPicks((current) => ({ ...current, [decision.key]: pick })) }, decision.key)))] })), preview.impacts.length > 0 && (_jsxs("section", { className: "flex flex-col gap-2", "aria-label": t("review.changes"), children: [_jsx("h3", { className: "font-medium text-sm", children: t("review.changes") }), _jsx("ul", { className: "flex flex-col gap-1.5", children: preview.impacts.map((impact) => (_jsx(Impact, { impact: impact }, impact.key))) })] })), preview.transforms.length > 0 && (_jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("review.transforms", { ids: preview.transforms.map((item) => item.id).join(", ") }) }))] })), saveError && (_jsxs(Alert, { variant: "danger", layout: "stack", children: [_jsx(TriangleAlert, { "aria-hidden": true }), _jsx(AlertDescription, { children: saveError.message })] }))] }), _jsx(DialogFooter, { children: saveError?.conflict || saveError?.applyFailed ? (_jsx(Button, { type: "button", onClick: reloadPage, children: t("save.reload") })) : (_jsxs(_Fragment, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => onOpenChange(false), children: t("review.cancel") }), _jsx(Button, { type: "button", disabled: !ready, onClick: () => void save(), children: saving ? t("review.saving") : t("review.save") })] })) })] }) }));
}
