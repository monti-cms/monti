"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// The loading and load-error states of the entry editor screen.
import { useSite, useTranslator } from "@monti-cms/core/client";
import { AdminLink as Link } from "../../router/index.js";
import { Alert, AlertDescription } from "../../ui/alert.js";
import { buttonVariants } from "../../ui/button.js";
import { Skeleton } from "../../ui/skeleton.js";
import { entryEditorShellMessages } from "./entry-editor-shell.messages.js";
export function EntryEditorLoading() {
    const t = useTranslator(entryEditorShellMessages);
    return (_jsxs("div", { className: "space-y-4 p-8", "aria-busy": true, children: [_jsx("span", { className: "sr-only", children: t("loadingDocument") }), _jsx(Skeleton, { className: "h-8 w-1/2" }), _jsx(Skeleton, { className: "h-4 w-full" }), _jsx(Skeleton, { className: "h-4 w-5/6" })] }));
}
export function EntryEditorLoadError({ message }) {
    const site = useSite();
    const t = useTranslator(entryEditorShellMessages);
    return (_jsxs("div", { className: "space-y-3 p-8", children: [_jsx(Alert, { variant: "destructive", children: _jsx(AlertDescription, { className: "col-start-auto", children: message }) }), _jsx(Link, { href: site.adminHref(), className: buttonVariants({ variant: "outline" }), children: t("backToList") })] }));
}
