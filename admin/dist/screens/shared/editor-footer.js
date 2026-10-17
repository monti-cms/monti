import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/site";
import { commonMessages } from "../../lib/common.messages.js";
import { cn } from "../../lib/utils/cn.js";
import { Button } from "../../ui/button.js";
import { FormFieldError } from "../../ui/field.js";
/**
 * The action row under an edit form: the error of the last attempt, Save (enabled while there are unsaved changes), Cancel (when `onCancel` is
 * given: a new item can be abandoned), anything extra, and Delete at the far end (when `onDelete` is given). Pair it with `useDraftEditor`.
 */
export function EditorFooter({ dirty, saving = false, deleting = false, canSave = true, error, onSave, onCancel, onDelete, saveLabel, saveIcon, align = "start", children, className, }) {
    const t = useTranslator(commonMessages);
    const busy = saving || deleting;
    return (_jsxs("div", { className: cn("space-y-2", className), children: [error && _jsx(FormFieldError, { className: "whitespace-pre-wrap", children: error }), _jsxs("div", { className: cn("flex flex-wrap items-center gap-2", align === "end" && "justify-end"), children: [_jsxs(Button, { type: onSave ? "button" : "submit", size: "sm", disabled: busy || !dirty || !canSave, onClick: onSave, children: [saveIcon, saving ? t("saving") : (saveLabel ?? t("save"))] }), onCancel && (_jsx(Button, { type: "button", size: "sm", variant: "outline", disabled: busy, onClick: onCancel, children: t("cancel") })), children, onDelete && (_jsx(Button, { type: "button", size: "sm", variant: "ghost", disabled: busy, className: cn("text-monti-destructive hover:bg-monti-destructive-soft hover:text-monti-destructive", align === "start" && "ml-auto"), onClick: onDelete, children: deleting ? t("deleting") : t("delete") }))] })] }));
}
