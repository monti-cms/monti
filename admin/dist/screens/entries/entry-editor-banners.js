"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { issueText, useSite, useTranslator } from "@monti-cms/core/site";
import { issueLine } from "../../api/error-message.js";
import { Button } from "../../ui/button.js";
import { FormFieldError } from "../../ui/field.js";
import { nounVars } from "../shared/noun.messages.js";
import { entryEditorShellMessages } from "./entry-editor-shell.messages.js";
export function EntryEditorBanners({ editor, visualUnavailable, sourceProblem, onFocusIssue, sourceChanged, onCompareSource, }) {
    const site = useSite();
    const t = useTranslator(entryEditorShellMessages);
    const { entry, collection, saveStatus, publishIssues } = editor;
    const isReadOnly = editor.readOnly;
    const isTrashed = entry?.status === "trashed";
    return (_jsxs(_Fragment, { children: [isTrashed && (_jsx("section", { "aria-label": t("trash"), className: "flex flex-wrap items-center gap-2 border-b bg-monti-muted px-4 py-2 text-sm", children: _jsx("span", { children: t("trashNotice", nounVars(site, collection)) }) })), visualUnavailable && (_jsxs("output", { className: "border-b bg-monti-warning-soft px-4 py-2 text-monti-warning-foreground text-sm", children: [t("visualUnavailable"), " ", sourceProblem ? issueLine(issueText(site, sourceProblem)) : ""] })), editor.saveError && ["failed", "session-expired"].includes(saveStatus) && (_jsx(FormFieldError, { className: "border-b px-4 py-2 text-sm", children: editor.saveError.message })), publishIssues.length > 0 && (_jsx("ul", { className: "max-h-36 overflow-y-auto border-b px-4 py-2 text-sm", "aria-label": t("publishProblems"), children: publishIssues.map((issue) => (_jsx("li", { children: _jsx(Button, { type: "button", variant: "link", size: "xs", className: "h-auto whitespace-normal px-0 text-left", onClick: () => onFocusIssue(issue), children: issueLine(issue) }) }, JSON.stringify(issue)))) })), sourceChanged && (_jsxs("output", { className: "flex flex-wrap items-center gap-2 border-b bg-monti-warning-soft px-4 py-1.5 text-sm", children: [_jsx("span", { className: "flex-1 font-medium text-monti-warning-foreground", children: t("sourceChanged") }), _jsx(Button, { type: "button", size: "sm", variant: "outline", onClick: onCompareSource, children: t("compare") }), _jsx(Button, { type: "button", size: "sm", variant: "outline", disabled: isReadOnly, onClick: editor.confirmTranslationSource, children: t("confirm") })] }))] }));
}
