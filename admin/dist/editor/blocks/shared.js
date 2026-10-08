"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils/cn.js";
import { IconButton } from "../../ui/icon-button.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover.js";
import { BLOCK_TOOLBAR } from "./block-model.js";
import { blocksMessages } from "./messages.js";
export { BLOCK_TOOLBAR, SELECTED_RING, useEditorEditable } from "./block-model.js";
/**
 * Input field for attributes (title, tab name). During Korean composition it does not write to the document, and writes when composition ends.
 * Enter returns to the body and Escape returns to the editor.
 */
export function AttributeInput({ value, onCommit, onEnter, onEscape, required = false, onBlur, className, ...props }) {
    const [draft, setDraft] = useState(value);
    const composingRef = useRef(false);
    const focusedRef = useRef(false);
    // Values are written to the document on every input, so remember the value to restore on Escape when the field is entered.
    const initialRef = useRef(value);
    // Keep the blur following Escape from writing the just-typed value again (the draft state is not updated yet).
    const escapingRef = useRef(false);
    // The last value written to the document. Even if another write follows before the render catches up (e.g. right after Escape), the comparison stays consistent.
    const committedRef = useRef(value);
    // When the value changes from outside such as undo, follow it only when not typing.
    useEffect(() => {
        committedRef.current = value;
        if (!focusedRef.current)
            setDraft(value);
    }, [value]);
    const commit = (next) => {
        if (required && !next.trim())
            return;
        if (next === committedRef.current)
            return;
        committedRef.current = next;
        onCommit(next);
    };
    return (_jsx("input", { ...props, value: draft, onFocus: () => {
            focusedRef.current = true;
            initialRef.current = committedRef.current;
        }, onBlur: (event) => {
            focusedRef.current = false;
            if (escapingRef.current)
                escapingRef.current = false;
            else
                commit(draft);
            if (required && !draft.trim())
                setDraft(value);
            onBlur?.(event);
        }, onChange: (event) => {
            setDraft(event.target.value);
            if (!composingRef.current)
                commit(event.target.value);
        }, onCompositionStart: () => {
            composingRef.current = true;
        }, onCompositionEnd: (event) => {
            composingRef.current = false;
            commit(event.currentTarget.value);
        }, onKeyDown: (event) => {
            if (event.nativeEvent.isComposing || composingRef.current)
                return;
            if (event.key === "Enter") {
                event.preventDefault();
                commit(draft);
                onEnter?.();
            }
            else if (event.key === "Escape") {
                event.preventDefault();
                escapingRef.current = true;
                setDraft(initialRef.current);
                commit(initialRef.current);
                onEscape?.();
            }
        }, className: cn("min-w-0 border-0 bg-transparent p-0 outline-none placeholder:text-current placeholder:opacity-50 focus-visible:ring-0", className) }));
}
/** Control toolbar shown only when the mouse is over the container or the cursor is inside. */
export function ContainerToolbar({ visible, className, children, label, }) {
    return (_jsx("div", { role: "toolbar", "aria-label": label, contentEditable: false, className: cn(BLOCK_TOOLBAR, "absolute -top-3.5 right-2 transition-opacity", "opacity-0 group-focus-within/container:opacity-100 group-hover/container:opacity-100 has-aria-expanded:opacity-100", visible && "opacity-100", className), children: children }));
}
/** Icon button of the toolbar. Its name shows on mouse hover. */
export function ToolbarButton(props) {
    return _jsx(IconButton, { size: "icon-xs", ...props });
}
/**
 * Block settings button and its popover. All block attributes (width, alt text, initial state, etc.) go here.
 * Align the fields inside with `BlockSettingsField`.
 */
export function BlockSettings({ label: labelProp, open, onOpenChange, children, }) {
    const t = useTranslator(blocksMessages);
    const label = labelProp ?? t("settings.label");
    return (_jsxs(Popover, { open: open, onOpenChange: onOpenChange, children: [_jsx(ToolbarButton, { label: label, trigger: (button) => _jsx(PopoverTrigger, { render: button }), children: _jsx(Settings2, { "aria-hidden": true }) }), _jsx(PopoverContent, { align: "end", className: "flex w-72 flex-col gap-3 p-3 text-xs", children: children })] }));
}
/** One field in the settings popover (name above, input below). */
export function BlockSettingsField({ label, htmlFor, action, children, }) {
    return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsxs("div", { className: "flex min-h-6 items-center justify-between gap-2", children: [_jsx("label", { htmlFor: htmlFor, className: "text-cms-muted-foreground text-xs", children: label }), action] }), children] }));
}
