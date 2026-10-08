import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { entriesMessages } from "./messages.js";
/**
 * Read-only notice listing the values of fields the site has removed. The values are kept with the entry and saved back unchanged,
 * but no input edits them, so the author is told they exist. Renders nothing when there are none.
 */
export function RemovedFieldsNotice({ collection, metadata, }) {
    const t = useTranslator(entriesMessages);
    const site = useSite();
    const keys = site.isCollection(collection) ? site.orphanedMetadataKeys(collection, metadata ?? {}) : [];
    if (keys.length === 0)
        return null;
    return (_jsxs("div", { role: "note", className: "mb-4 space-y-1 rounded-md border border-dashed p-3 text-cms-muted-foreground text-xs", children: [_jsx("p", { className: "font-medium", children: t("inspector.removed.title") }), _jsx("p", { className: "break-words", children: t("inspector.removed.body", { keys: keys.join(", ") }) })] }));
}
