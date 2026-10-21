"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { Badge } from "../../ui/badge.js";
import { importMessages } from "./messages.js";
const OUTCOME_VARIANT = {
    imported: "success",
    draft: "warning",
    skipped: "secondary",
    failed: "destructive",
};
/** One step that did not go as asked, with its reason. */
function StepLine({ label, step }) {
    const t = useTranslator(importMessages);
    const status = t(`result.step.${step.status}`);
    return (_jsxs("li", { className: "text-xs leading-relaxed", children: [label && _jsxs("span", { className: "font-medium", children: [label, " "] }), _jsxs("span", { className: "text-monti-muted-foreground", children: [label ? `${status}${step.reason ? ": " : ""}` : "", step.reason ? `${step.reason.text}${step.reason.fix ? ` ${step.reason.fix}` : ""}` : ""] })] }));
}
function ResultRow({ entry }) {
    const t = useTranslator(importMessages);
    const site = useSite();
    const problems = [
        ...(entry.create.status !== "done" ? [[null, entry.create]] : []),
        ...(entry.body && entry.body.status !== "done"
            ? [[t("result.step.body"), entry.body]]
            : []),
        ...(entry.publish && entry.publish.status !== "done"
            ? [[t("result.step.publish"), entry.publish]]
            : []),
    ];
    // What the editor checks said about the saved body, once each.
    const warnings = [...new Set(entry.warnings.map((warning) => warning.text))];
    return (_jsxs("li", { className: "flex flex-col gap-1.5 border-b py-3 last:border-b-0", "data-testid": "import-result", "data-outcome": entry.outcome, children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 text-sm", children: [_jsx(Badge, { variant: OUTCOME_VARIANT[entry.outcome], children: t(`result.outcome.${entry.outcome}`) }), entry.id ? (_jsx("a", { href: site.adminEntryEditHref(entry.id), className: "font-medium underline-offset-4 hover:underline", children: entry.title ?? entry.slug ?? entry.key })) : (_jsx("span", { className: "font-medium", children: entry.title ?? entry.slug ?? entry.key })), _jsx("span", { className: "text-monti-muted-foreground text-xs", children: site.localeLabel(entry.locale) }), entry.publish?.status === "done" && _jsx(Badge, { variant: "outline", children: t("result.published", { count: 1 }) }), entry.id && (_jsx("a", { href: site.adminEntryEditHref(entry.id), className: "ml-auto text-monti-primary text-xs underline-offset-4 hover:underline", children: t("result.open") }))] }), (problems.length > 0 || entry.notes.length > 0 || warnings.length > 0) && (_jsxs("ul", { className: "flex flex-col gap-0.5 pl-1", children: [problems.map(([label, step]) => (_jsx(StepLine, { label: label, step: step }, label ?? "create"))), entry.notes.map((note) => (_jsx("li", { className: "text-monti-muted-foreground text-xs leading-relaxed", children: note.text }, note.code))), warnings.map((text) => (_jsx("li", { className: "text-monti-muted-foreground text-xs leading-relaxed", children: text }, text)))] }))] }));
}
/** What the import did, entry by entry: a link to every new entry, and the reason for each one that was skipped, failed or stayed a draft. */
export function ResultView({ result }) {
    const t = useTranslator(importMessages);
    const { counts } = result;
    return (_jsxs("div", { className: "flex flex-col gap-4", "data-testid": "import-run-result", children: [_jsx("h4", { className: "font-medium text-base", children: t("result.title") }), _jsx("p", { className: "text-monti-muted-foreground text-sm", "data-testid": "import-result-summary", children: [
                    t("result.imported", { count: counts.imported }),
                    counts.draft > 0 ? t("result.draft", { count: counts.draft }) : null,
                    t("result.skipped", { count: counts.skipped }),
                    counts.failed > 0 ? t("result.failed", { count: counts.failed }) : null,
                    counts.published > 0 ? t("result.published", { count: counts.published }) : null,
                ]
                    .filter(Boolean)
                    .join(" · ") }), _jsx("ul", { className: "max-h-[28rem] overflow-y-auto rounded-md border px-3", children: result.results.map((entry) => (_jsx(ResultRow, { entry: entry }, entry.key))) })] }));
}
