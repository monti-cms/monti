"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/site";
import { Button } from "../../ui/button.js";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog.js";
import { ExportButton, ExportFields, ExportProgressLine } from "./export-fields.js";
import { exportMessages } from "./messages.js";
import { useExportForm } from "./use-export-form.js";
function ExportDialogBody({ ids, noun = "", kind, unsaved, onClose, }) {
    const t = useTranslator(exportMessages);
    const form = useExportForm({ ids });
    return (_jsxs(_Fragment, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: kind === "entry" ? t("dialog.title.entry") : t("dialog.title.selected", { count: ids.length, noun }) }), _jsx(DialogDescription, { children: t("dialog.description") })] }), _jsx(ExportFields, { form: form, selection: true, noun: noun }), unsaved && (_jsx("p", { className: "text-monti-muted-foreground text-xs leading-relaxed", "data-testid": "export-unsaved", children: t("note.unsaved") })), _jsx(ExportProgressLine, { phase: form.phase }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: t("action.cancel") }), _jsx(ExportButton, { form: form, selection: true, label: t("action.selected"), onDone: onClose })] })] }));
}
/**
 * The export of selected entries, and of the one that is open in the editor: it states what goes in (the entries, the translations that come with them, the
 * folders, addresses and media records they use), offers the scope and the files, and downloads. The form lives only while the dialog is open, so it counts again each time.
 */
export function ExportDialog({ open, onOpenChange, ...body }) {
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsx(DialogContent, { className: "max-h-[90dvh] overflow-y-auto sm:max-w-xl", children: _jsx(ExportDialogBody, { ...body, onClose: () => onOpenChange(false) }) }) }));
}
