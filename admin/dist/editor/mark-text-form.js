"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createTranslator } from "@monti-cms/core/client";
import { X } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";
import { Textarea } from "../ui/textarea.js";
import { Toggle } from "../ui/toggle.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip.js";
import { collapseToEnd, PopoverFormError, PopoverFormFooter, submitOnEnter } from "./link-form.js";
import { editorMessages } from "./messages.js";
const t = createTranslator(editorMessages);
/** Decoration text input form. Shared by the formatting tool popover and the inline bubble. */
export function MarkTextForm({ editor, mark, attribute, labels, active, initial, range, onDone }) {
    const id = useId();
    const [value, setValue] = useState(initial);
    const [error, setError] = useState(null);
    const current = () => ({ [attribute]: editor.getAttributes(mark)[attribute] });
    const handleApply = (event) => {
        event.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) {
            setError(labels.empty);
            return;
        }
        const command = editor.chain().focus();
        if (range)
            command.setTextSelection(range).setMark(mark, { [attribute]: trimmed });
        else if (active)
            command.extendMarkRange(mark, current()).setMark(mark, { [attribute]: trimmed });
        else
            command.setMark(mark, { [attribute]: trimmed });
        collapseToEnd(command).run();
        onDone();
    };
    const handleRemove = () => {
        const { from, to } = editor.state.selection;
        const command = editor.chain().focus();
        if (range)
            command.setTextSelection(range);
        else
            command.extendMarkRange(mark, current());
        command.unsetMark(mark).setTextSelection({ from, to }).run();
        onDone();
    };
    return (_jsxs("form", { onSubmit: handleApply, onKeyDown: submitOnEnter, className: "grid gap-3", children: [_jsx("p", { className: "font-medium", children: active ? t("markText.edit", { name: labels.name }) : t("markText.add", { name: labels.name }) }), _jsxs("label", { htmlFor: `${id}-content`, className: "grid gap-1.5 text-xs", children: [labels.field, _jsx(Textarea, { id: `${id}-content`, value: value, rows: 2, "aria-invalid": !!error || undefined, "aria-describedby": error ? `${id}-error` : undefined, onChange: (event) => {
                            setValue(event.target.value);
                            setError(null);
                        }, className: "min-h-0", autoFocus: true })] }), error && _jsx(PopoverFormError, { id: `${id}-error`, children: error }), _jsx(PopoverFormFooter, { removeLabel: t("markText.remove", { name: labels.name }), removeIcon: _jsx(X, { "aria-hidden": true }), onRemove: active ? handleRemove : undefined, onCancel: onDone })] }));
}
/**
 * Decoration text popover of the formatting tool. Disabled when the selection is empty and not inside a decoration. When the cursor is inside a decoration it is pressed, and the text can be edited or removed.
 * Enter is ignored during Korean IME composition.
 */
export function MarkTextPopover({ editor, mark, attribute, labels, icon, openEvent }) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState("");
    const isActive = editor.isActive(mark);
    const disabled = !editor.isEditable || (editor.state.selection.empty && !isActive);
    const existing = useCallback(() => String(editor.getAttributes(mark)[attribute] ?? ""), [editor, mark, attribute]);
    const handleOpenChange = useCallback((nextOpen) => {
        if (disabled && nextOpen)
            return;
        if (nextOpen)
            setValue(existing());
        setOpen(nextOpen);
    }, [disabled, existing]);
    useEffect(() => {
        if (!openEvent)
            return;
        const onOpen = () => {
            if (!editor.isEditable)
                return;
            if (editor.state.selection.empty && !editor.isActive(mark))
                return;
            setValue(existing());
            setOpen(true);
        };
        window.addEventListener(openEvent, onOpen);
        return () => window.removeEventListener(openEvent, onOpen);
    }, [editor, mark, existing, openEvent]);
    return (_jsxs(Popover, { open: open, onOpenChange: handleOpenChange, children: [_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { render: _jsx(PopoverTrigger, { render: _jsx(Toggle, { size: "sm", pressed: isActive, disabled: disabled, "aria-label": labels.name, onMouseDown: (event) => event.preventDefault(), className: "size-8 p-0" }), children: icon }) }), _jsx(TooltipContent, { side: "bottom", children: labels.name })] }), _jsx(PopoverContent, { align: "center", className: "w-80 p-3 text-xs", children: _jsx(MarkTextForm, { editor: editor, mark: mark, attribute: attribute, labels: labels, active: isActive, initial: value, onDone: () => setOpen(false) }, String(open)) })] }));
}
