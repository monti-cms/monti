"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { MoveHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { readPreference, writePreference } from "../lib/utils/site-storage.js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger, } from "../ui/dropdown-menu.js";
import { IconButton } from "../ui/icon-button.js";
import { editorMessages } from "./messages.js";
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
const LABELS = (t) => ({
    narrow: t("editorWidth.narrow"),
    normal: t("editorWidth.normal"),
    wide: t("editorWidth.wide"),
    full: t("editorWidth.full"),
});
/** Name of the remembered width in the site's browser storage (`lib/utils/site-storage.ts`). */
const STORAGE_NAME = "editor-width";
const isEditorWidth = (value) => typeof value === "string" && Object.hasOwn(EDITOR_WIDTHS, value);
/** Chosen body width. Remembered in this browser, per site; starts at the normal width if storage is unavailable. */
export function useEditorWidth() {
    const site = useSite();
    const [width, setWidth] = useState("normal");
    useEffect(() => {
        const stored = readPreference(site, STORAGE_NAME);
        if (isEditorWidth(stored))
            setWidth(stored);
    }, [site]);
    const change = (next) => {
        setWidth(next);
        writePreference(site, STORAGE_NAME, next);
    };
    return [width, change];
}
/** Body width menu at the right end of the toolbar. */
export function EditorWidthMenu({ value, onChange }) {
    const t = useTranslator(editorMessages);
    return (_jsxs(DropdownMenu, { children: [_jsx(IconButton, { label: t("editorWidth.label"), side: "bottom", className: "text-cms-muted-foreground", onMouseDown: (event) => event.preventDefault(), trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: _jsx(MoveHorizontal, { "aria-hidden": true, className: "size-4" }) }), _jsx(DropdownMenuContent, { align: "end", className: "w-36", children: _jsx(DropdownMenuRadioGroup, { "aria-label": t("editorWidth.label"), value: value, onValueChange: (next) => isEditorWidth(next) && onChange(next), children: Object.keys(EDITOR_WIDTHS).map((width) => (_jsx(DropdownMenuRadioItem, { value: width, children: LABELS(t)[width] }, width))) }) })] }));
}
