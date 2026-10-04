"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { diffSources } from "@monti-cms/core/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog.js";
import { MdxPreview } from "./source-pane.js";
import { t } from "./translate.js";
const KIND_LABELS = {
    changed: t("sourceChange.changed"),
    added: t("sourceChange.added"),
    removed: t("sourceChange.removed"),
};
/** Text of a header-row fragment (`{"title":..}`, `{"labels":[..]}`). */
const headerText = (source) => {
    try {
        const value = JSON.parse(source);
        if (typeof value.title === "string")
            return value.title;
        if (Array.isArray(value.labels))
            return value.labels.join(" · ");
    }
    catch {
        // A broken fragment is shown as is.
    }
    return source;
};
function UnitView({ unit }) {
    return unit.kind === "header" ? (_jsx("p", { className: "text-sm", children: headerText(unit.source) })) : (_jsx(MdxPreview, { mdx: unit.source }));
}
function ChangeItem({ change }) {
    const before = change.kind === "added" ? null : change.before;
    const after = change.kind === "removed" ? null : change.after;
    return (_jsxs("li", { className: "flex flex-col gap-2 rounded-md border p-3", children: [_jsx("span", { className: "w-fit rounded bg-cms-muted px-1.5 py-0.5 font-medium text-xs", children: KIND_LABELS[change.kind] }), _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [before && (_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "mb-1 text-cms-muted-foreground text-xs", children: t("sourceChange.before") }), _jsx(UnitView, { unit: before })] })), after && (_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "mb-1 text-cms-muted-foreground text-xs", children: t("sourceChange.after") }), _jsx(UnitView, { unit: after })] }))] })] }));
}
/** List of blocks that differ between the source the translator last confirmed and the current source. */
export function SourceChangeDialog({ open, onOpenChange, before, after, }) {
    const changes = open ? diffSources(before, after) : null;
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-h-[90vh] max-w-4xl overflow-y-auto", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t("sourceChange.title") }), _jsx(DialogDescription, { children: t("sourceChange.description") })] }), changes === null ? (_jsx("p", { className: "text-cms-muted-foreground text-sm", children: t("sourceChange.cantCompare") })) : changes.length === 0 ? (_jsx("p", { className: "text-cms-muted-foreground text-sm", children: t("sourceChange.none") })) : (_jsx("ol", { className: "flex flex-col gap-3", children: changes.map((change, index) => (_jsx(ChangeItem, { change: change }, index))) }))] }) }));
}
