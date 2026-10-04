"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { toast } from "sonner";
import { Button } from "../../ui/button.js";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog.js";
import { useConfirm } from "../shared/confirm-dialog.js";
import { formatDateTime } from "../shared/format-date.js";
import { formFromEntry } from "./entry-form.js";
import { t } from "./translate.js";
/** Asks whether to load a browser temporary copy that is not on the server. */
export function RecoveryDialog({ recovery, onClose, onKeepServer, onRestore, }) {
    return (_jsx(Dialog, { open: recovery !== null, onOpenChange: (open) => !open && onClose(), children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t("recovery.title") }), _jsxs(DialogDescription, { children: [recovery ? t("recovery.description", { date: formatDateTime(recovery.backup.savedAt) }) : "", recovery?.kind === "conflict" && t("recovery.conflict")] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => recovery && onKeepServer(recovery), children: t("recovery.keepServer") }), _jsx(Button, { type: "button", onClick: () => recovery && onRestore(recovery), children: t("recovery.restore") })] })] }) }));
}
/** When someone saved elsewhere first during autosave or publish. Compare both sides, then copy or pick one. */
export function ConflictDialog({ conflict, onClose, onReload, onOverwrite, }) {
    const { confirm, dialog } = useConfirm();
    // This replaces the latest server copy wholesale, so ask once more.
    const overwrite = async () => {
        if (!conflict)
            return;
        const serverVersion = conflict.server.version;
        if (await confirm({
            title: t("conflict.overwrite"),
            description: t("conflict.overwriteAsk"),
            confirmLabel: t("conflict.overwrite"),
            destructive: true,
        })) {
            onOverwrite(serverVersion);
        }
    };
    return (_jsx(Dialog, { open: conflict !== null, onOpenChange: (open) => !open && onClose(), children: _jsxs(DialogContent, { className: "max-h-[90vh] max-w-4xl overflow-y-auto", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t("conflict.title") }), _jsx(DialogDescription, { children: t("conflict.description") })] }), conflict && (_jsx(ComparePanes, { local: conflict.local, server: formFromEntry(conflict.server), serverVersion: conflict.server.version })), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: t("close") }), _jsx(Button, { type: "button", variant: "outline", onClick: onReload, children: t("conflict.reload") }), _jsx(Button, { type: "button", variant: "destructive", onClick: () => void overwrite(), children: t("conflict.overwriteMine") })] }), dialog] }) }));
}
/** Side-by-side comparison on the conflict screen ("check and copy both contents"). */
function ComparePanes({ local, server, serverVersion, }) {
    const copy = async (mdx) => {
        try {
            await navigator.clipboard.writeText(mdx);
            toast.success(t("conflict.copied"));
        }
        catch {
            toast.error(t("conflict.copyFailed"));
        }
    };
    const pane = (label, value) => (_jsxs("div", { className: "space-y-2 rounded border p-3", children: [_jsx("p", { className: "font-semibold text-sm", children: label }), _jsx("p", { className: "text-xs", children: t("conflict.summary", { title: value.title || t("untitled"), slug: value.slug || t("conflict.noSlug") }) }), _jsx(Button, { type: "button", variant: "link", size: "xs", className: "px-0", onClick: () => void copy(value.mdx), children: t("conflict.copyBody") }), _jsx("pre", { className: "max-h-60 overflow-auto whitespace-pre-wrap text-xs", children: value.mdx })] }));
    return (_jsxs("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-2", children: [pane(t("conflict.mine"), local), pane(t("conflict.server", { version: serverVersion }), server)] }));
}
