"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createTranslator } from "@monti-cms/core/client";
import { useCallback, useRef, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "../../ui/alert-dialog.js";
import { sharedMessages } from "./messages.js";
const t = createTranslator(sharedMessages);
/** Confirm dialog for hard-to-undo actions. On cancel, focus returns to the button that opened it. */
export function ConfirmDialog({ request, onClose }) {
    return (_jsx(AlertDialog, { open: request !== null, onOpenChange: (open) => !open && onClose(), children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: request?.title }), _jsx(AlertDialogDescription, { render: typeof request?.description === "string" ? undefined : _jsx("div", {}), children: request?.description })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { type: "button", children: t("common.cancel") }), _jsx(AlertDialogAction, { type: "button", variant: request?.destructive ? "destructive" : "default", onClick: () => {
                                const action = request?.onConfirm;
                                onClose();
                                void action?.();
                            }, children: request?.confirmLabel })] })] }) }));
}
/** The question asked when discarding unsaved content. Every edit slot with a save button uses the same wording. */
export const DISCARD_CONFIRM = {
    title: t("discard.title"),
    description: t("discard.description"),
    confirmLabel: t("discard.confirm"),
    destructive: true,
};
/**
 * Opens the confirm dialog as a Promise. `confirm(...)` resolves to true or false depending on which button was pressed.
 * Render `dialog` once somewhere on the screen.
 */
export function useConfirm() {
    const [request, setRequest] = useState(null);
    const resolveRef = useRef(null);
    const confirm = useCallback((next) => new Promise((resolve) => {
        resolveRef.current?.(false);
        resolveRef.current = resolve;
        setRequest({
            ...next,
            onConfirm: () => {
                resolveRef.current = null;
                resolve(true);
            },
        });
    }), []);
    /** Asks whether to discard only when `dirty`. If clean, it is true immediately. */
    const confirmDiscard = useCallback((dirty) => (dirty ? confirm(DISCARD_CONFIRM) : Promise.resolve(true)), [confirm]);
    const dialog = (_jsx(ConfirmDialog, { request: request, onClose: () => {
            setRequest(null);
            // Pressing confirm calls onConfirm right after onClose. If the pending state is still there after that, it was a cancel.
            queueMicrotask(() => {
                resolveRef.current?.(false);
                resolveRef.current = null;
            });
        } }));
    return { confirm, confirmDiscard, dialog };
}
