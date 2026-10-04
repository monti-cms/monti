"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createTranslator } from "@monti-cms/core/client";
import { MoveHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger, } from "../ui/dropdown-menu.js";
import { IconButton } from "../ui/icon-button.js";
import { editorMessages } from "./messages.js";
const t = createTranslator(editorMessages);
/**
 * Editor body width. Changes only the width shown while editing; unrelated to the saved content and the public page.
 * The browser remembers only the step name, so the width values can be changed here alone.
 */
export const EDITOR_WIDTHS = {
    /** Comfortable reading width for body text (42rem, same as Tailwind `max-w-2xl`). */
    narrow: "42rem",
    normal: "48rem",
    wide: "64rem",
    full: "none",
};
const LABELS = {
    narrow: t("editorWidth.narrow"),
    normal: t("editorWidth.normal"),
    wide: t("editorWidth.wide"),
    full: t("editorWidth.full"),
};
const STORAGE_KEY = "cms:editor-width";
const isEditorWidth = (value) => typeof value === "string" && Object.hasOwn(EDITOR_WIDTHS, value);
/** Chosen body width. Remembered in this browser; starts at the normal width if storage is unavailable. */
export function useEditorWidth() {
    const [width, setWidth] = useState("normal");
    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (isEditorWidth(stored))
                setWidth(stored);
        }
        catch {
            // Use the default width if storage is unavailable.
        }
    }, []);
    const change = (next) => {
        setWidth(next);
        try {
            window.localStorage.setItem(STORAGE_KEY, next);
        }
        catch {
            // The width still changes even if it cannot be remembered.
        }
    };
    return [width, change];
}
/** Body width menu at the right end of the toolbar. */
export function EditorWidthMenu({ value, onChange }) {
    return (_jsxs(DropdownMenu, { children: [_jsx(IconButton, { label: t("editorWidth.label"), side: "bottom", className: "text-cms-muted-foreground", onMouseDown: (event) => event.preventDefault(), trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: _jsx(MoveHorizontal, { "aria-hidden": true, className: "size-4" }) }), _jsx(DropdownMenuContent, { align: "end", className: "w-36", children: _jsx(DropdownMenuRadioGroup, { "aria-label": t("editorWidth.label"), value: value, onValueChange: (next) => isEditorWidth(next) && onChange(next), children: Object.keys(EDITOR_WIDTHS).map((width) => (_jsx(DropdownMenuRadioItem, { value: width, children: LABELS[width] }, width))) }) })] }));
}
