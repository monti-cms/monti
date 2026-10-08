"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { cn } from "../lib/utils/cn.js";
import { useLinkTarget } from "./link-targets.js";
import { editorMessages } from "./messages.js";
const nameOf = (t, target) => target.title || t("toolbar.untitled");
/**
 * Where an internal link goes, shown in the link bubble: the title and the address of the entry, which opens the entry (its page on the site when it is
 * published, otherwise the entry in the admin). The document holds only the id of the entry, so the entry is looked up (`useLinkTarget`).
 */
export function LinkTargetAnchor({ entryId, className }) {
    const t = useTranslator(editorMessages);
    const state = useLinkTarget(entryId);
    if (!state || state.status === "loading") {
        return _jsx("span", { className: cn("px-1 text-cms-muted-foreground text-xs", className), children: t("link.targetLoading") });
    }
    if (state.status === "missing") {
        return _jsx("span", { className: cn("px-1 text-cms-destructive text-xs", className), children: t("link.targetMissing") });
    }
    if (state.status === "error") {
        return (_jsx("span", { className: cn("px-1 text-cms-muted-foreground text-xs", className), children: t("link.targetUnavailable") }));
    }
    const { target } = state;
    const label = target.published
        ? t("link.targetOpenSite", { title: nameOf(t, target) })
        : t("link.targetOpenAdmin", { title: nameOf(t, target) });
    return (_jsxs("a", { href: target.href, target: "_blank", rel: "noreferrer noopener", title: label, "aria-label": label, 
        // If focus is taken from the editor on press, the bubble disappears first and the link does not open.
        onMouseDown: (event) => event.preventDefault(), className: cn("flex min-w-0 max-w-64 flex-col px-1 text-xs", className), children: [_jsx("span", { className: "truncate text-cms-primary underline underline-offset-2", children: nameOf(t, target) }), _jsxs("span", { className: "truncate text-cms-muted-foreground", children: [target.path ?? "", target.published ? "" : `${target.path ? " · " : ""}${t("link.targetDraft")}`] })] }));
}
/** A line in the link form saying where the link goes now. */
export function LinkTargetSummary({ entryId }) {
    const t = useTranslator(editorMessages);
    const state = useLinkTarget(entryId);
    let text;
    if (!state || state.status === "loading")
        text = t("link.targetLoading");
    else if (state.status === "missing")
        text = t("link.targetMissing");
    else if (state.status === "error")
        text = t("link.targetUnavailable");
    else
        text = t("link.target", { title: nameOf(t, state.target) });
    const path = state?.status === "ready" ? state.target.path : null;
    return (_jsxs("div", { className: "grid gap-0.5 text-xs", children: [_jsx("p", { className: cn(state?.status === "missing" && "text-cms-destructive"), children: text }), path && _jsx("p", { className: "text-cms-muted-foreground", children: path }), _jsx("p", { className: "text-cms-muted-foreground", children: t("link.replaceHint") })] }));
}
