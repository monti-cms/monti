"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createTranslator } from "@monti-cms/core/client";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { useEditorState } from "@tiptap/react";
import { Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils/cn.js";
import { IconButton } from "../../ui/icon-button.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover.js";
import { blocksMessages } from "./messages.js";
const t = createTranslator(blocksMessages);
/** Selected block border. All blocks use the same look. */
export const SELECTED_RING = "ring-2 ring-cms-ring ring-offset-2 ring-offset-cms-background";
/** Look of the control toolbar floating over a block (shared by the block toolbar, images, and tables). */
export const BLOCK_TOOLBAR = "z-10 flex items-center gap-0.5 rounded-md border bg-cms-popover/95 p-0.5 text-cms-popover-foreground shadow-sm backdrop-blur";
export const valuesOf = (node) => (node.attrs.values ?? {});
/** Emptied values (empty string, false) are removed from attributes. Keeping them would save a `title=""` that was not in the source. */
export const withValue = (values, key, value) => {
    const { [key]: _removed, ...rest } = values;
    return value === "" || value === false ? rest : { ...rest, [key]: value };
};
export const useContainerValues = ({ node, updateAttributes }) => {
    const values = valuesOf(node);
    const setValue = (key, value) => updateAttributes({ values: withValue(values, key, value) });
    return [values, setValue];
};
/**
 * Whether the editor can be edited. Re-renders when the lock (trash, raw mode) changes.
 * A node view that reads `editor.isEditable` once while rendering does not follow lock changes, so use this.
 */
export function useEditorEditable(editor) {
    // When rendering without an editor (preview, fake editor in tests), do not subscribe and read the value at that time.
    const tracked = typeof editor?.on === "function" ? editor : null;
    const editable = useEditorState({
        editor: tracked,
        selector: ({ editor: current }) => current?.isEditable ?? true,
    });
    return tracked ? (editable ?? true) : (editor?.isEditable ?? true);
}
/** Start position of the i-th child inside the parent container. */
export const childPos = (parent, parentPos, index) => {
    let offset = parentPos + 1;
    for (let i = 0; i < index; i += 1)
        offset += parent.child(i).nodeSize;
    return offset;
};
/**
 * Which child of this container the current selection is in. -1 if outside.
 * -1 when the editor has no focus, so that the cursor at the very start of the document when first opening a post (the first tab if the first block is tabs)
 * does not overwrite the initial open tab or collapsed state.
 */
export const useSelectedChildIndex = (editor, getPos) => useEditorState({
    editor,
    selector: ({ editor: current }) => {
        const pos = getPos();
        if (!current?.isFocused || typeof pos !== "number")
            return -1;
        const parent = current.state.doc.nodeAt(pos);
        const { from } = current.state.selection;
        if (!parent || from <= pos || from >= pos + parent.nodeSize)
            return -1;
        let offset = pos + 1;
        for (let i = 0; i < parent.childCount; i += 1) {
            const end = offset + parent.child(i).nodeSize;
            if (from >= offset && from < end)
                return i;
            offset = end;
        }
        return -1;
    },
}) ?? -1;
/** Moves the cursor into the container (a child index or the start of the body). */
export const focusInside = (editor, getPos, index) => {
    const pos = getPos();
    if (typeof pos !== "number")
        return;
    editor
        .chain()
        .focus()
        .command(({ tr }) => {
        const parent = tr.doc.nodeAt(pos);
        if (!parent)
            return false;
        const start = index === undefined ? pos + 1 : childPos(parent, pos, index) + 1;
        tr.setSelection(TextSelection.near(tr.doc.resolve(start)));
        return true;
    })
        .scrollIntoView()
        .run();
};
/** Selects the whole container (when no cursor should be left inside the body to hide). */
export const selectContainer = (editor, getPos) => {
    const pos = getPos();
    if (typeof pos !== "number")
        return;
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)));
};
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
export function BlockSettings({ label = t("settings.label"), open, onOpenChange, children, }) {
    return (_jsxs(Popover, { open: open, onOpenChange: onOpenChange, children: [_jsx(ToolbarButton, { label: label, trigger: (button) => _jsx(PopoverTrigger, { render: button }), children: _jsx(Settings2, { "aria-hidden": true }) }), _jsx(PopoverContent, { align: "end", className: "flex w-72 flex-col gap-3 p-3 text-xs", children: children })] }));
}
/** One field in the settings popover (name above, input below). */
export function BlockSettingsField({ label, htmlFor, action, children, }) {
    return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsxs("div", { className: "flex min-h-6 items-center justify-between gap-2", children: [_jsx("label", { htmlFor: htmlFor, className: "text-cms-muted-foreground text-xs", children: label }), action] }), children] }));
}
