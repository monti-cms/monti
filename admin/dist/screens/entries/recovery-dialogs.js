"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { toast } from "sonner";
import { useSourceFormat } from "../../admin-components.js";
import { Button } from "../../ui/button.js";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog.js";
import { useConfirm } from "../shared/confirm-dialog.js";
import { formatDateTime } from "../shared/format-date.js";
import { formFromEntry, formTitle } from "./entry-form.js";
import { entriesMessages } from "./messages.js";
/**
 * Asks whether to load a browser temporary copy that is not on the server (`useEntryEditor().recovery`). It is a `conflict` offer if the server has
 * changed since the copy was made. Closing the dialog only hides it; the copy is kept until the user answers.
 */
export function RecoveryDialog({ recovery, onClose, onKeepServer, onRestore, }) {
    const t = useTranslator(entriesMessages);
    const site = useSite();
    return (_jsx(Dialog, { open: recovery !== null, onOpenChange: (open) => !open && onClose(), children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t("recovery.title") }), _jsxs(DialogDescription, { children: [recovery ? t("recovery.description", { date: formatDateTime(site, recovery.savedAt) }) : "", recovery?.kind === "conflict" && t("recovery.conflict")] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onKeepServer, children: t("recovery.keepServer") }), _jsx(Button, { type: "button", onClick: onRestore, children: t("recovery.restore") })] })] }) }));
}
/**
 * When someone saved elsewhere first during a save or publish (`useEntryEditor().conflict`). Compare both sides, then copy or pick one.
 * Neither answer reloads the page: the editor loads the server version, or saves on top of it.
 */
export function ConflictDialog({ conflict, onClose, onReload, onOverwrite, }) {
    const site = useSite();
    const t = useTranslator(entriesMessages);
    const { confirm, dialog } = useConfirm();
    // This replaces the latest server copy wholesale, so ask once more.
    const overwrite = async () => {
        if (!conflict)
            return;
        if (await confirm({
            title: t("conflict.overwrite"),
            description: t("conflict.overwriteAsk"),
            confirmLabel: t("conflict.overwrite"),
            destructive: true,
        })) {
            onOverwrite();
        }
    };
    return (_jsx(Dialog, { open: conflict !== null, onOpenChange: (open) => !open && onClose(), children: _jsxs(DialogContent, { className: "max-h-[90vh] max-w-4xl overflow-y-auto", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t("conflict.title") }), _jsx(DialogDescription, { children: t("conflict.description") }), conflict?.server.changedAt && (_jsx("p", { className: "font-medium text-sm", children: conflict.server.changedBy
                                ? t("conflict.savedBy", {
                                    name: conflict.server.changedBy,
                                    date: formatDateTime(site, conflict.server.changedAt),
                                })
                                : t("conflict.savedAt", { date: formatDateTime(site, conflict.server.changedAt) }) }))] }), conflict && (_jsx(ComparePanes, { collection: conflict.server.collection, local: conflict.local, server: formFromEntry(site, conflict.server), serverVersion: conflict.server.version })), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: t("close") }), _jsx(Button, { type: "button", variant: "outline", onClick: onReload, children: t("conflict.reload") }), _jsx(Button, { type: "button", variant: "destructive", onClick: () => void overwrite(), children: t("conflict.overwriteMine") })] }), dialog] }) }));
}
/** Side-by-side comparison on the conflict screen ("check and copy both contents"). */
function ComparePanes({ collection, local, server, serverVersion, }) {
    const site = useSite();
    const t = useTranslator(entriesMessages);
    // The body is shown as text in the notation of the source panel; without one, as the document itself.
    const format = useSourceFormat();
    const bodyText = (doc) => (format ? format.export(doc) : JSON.stringify(doc, null, 2));
    const copy = async (body) => {
        try {
            await navigator.clipboard.writeText(body);
            toast.success(t("conflict.copied"));
        }
        catch {
            toast.error(t("conflict.copyFailed"));
        }
    };
    const pane = (label, value) => {
        const body = bodyText(value.doc);
        return (_jsxs("div", { className: "space-y-2 rounded border p-3", children: [_jsx("p", { className: "font-semibold text-sm", children: label }), _jsx("p", { className: "text-xs", children: t("conflict.summary", {
                        title: formTitle(site, collection, value) || t("untitled"),
                        slug: value.slug || t("conflict.noSlug"),
                    }) }), _jsx(Button, { type: "button", variant: "link", size: "xs", className: "px-0", onClick: () => void copy(body), children: t("conflict.copyBody") }), _jsx("pre", { className: "max-h-60 overflow-auto whitespace-pre-wrap text-xs", children: body })] }));
    };
    return (_jsxs("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-2", children: [pane(t("conflict.mine"), local), pane(t("conflict.server", { version: serverVersion }), server)] }));
}
