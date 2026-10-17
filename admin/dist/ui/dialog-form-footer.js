import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/site";
import { commonMessages } from "../lib/common.messages.js";
import { Button } from "./button.js";
import { DialogFooter } from "./dialog.js";
/**
 * The footer of a dialog that holds a form: Cancel and a submit button. The submit button shows `busyLabel` (default "Saving…") while the
 * request runs. Put it inside the `<form>`; the dialog closes through `onCancel`.
 */
export function DialogFormFooter({ onCancel, submitLabel, busyLabel, busy = false, disabled = false, cancelLabel, }) {
    const t = useTranslator(commonMessages);
    return (_jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onCancel, children: cancelLabel ?? t("cancel") }), _jsx(Button, { type: "submit", disabled: disabled || busy, children: busy ? (busyLabel ?? t("saving")) : (submitLabel ?? t("save")) })] }));
}
