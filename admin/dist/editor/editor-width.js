"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { MoveHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { readPreference, writePreference } from "../lib/utils/site-storage.js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger, } from "../ui/dropdown-menu.js";
import { IconButton } from "../ui/icon-button.js";
import { editorMessages } from "./messages.js";
/** The width of the single built-in step ("Normal") used when the config sets no `editor.widths`. */
export const DEFAULT_EDITOR_WIDTH = "48rem";
/** The `max-width` of the last step, "Full": no limit. */
export const FULL_EDITOR_WIDTH = "none";
/** Key of the built-in steps. The step of the config is remembered by its label (`label:Desktop`), so a changed config still finds it. */
const NORMAL_KEY = "normal";
const FULL_KEY = "full";
/**
 * The steps of the width menu, in order: the config's `editor.widths` (or "Normal" when it sets none), then "Full". The first is where the editor starts.
 * Changes only the width shown while editing; unrelated to the saved content and the public page.
 */
export function resolveEditorWidths(configured, t) {
    const steps = configured?.length
        ? configured.map(({ label, width }) => ({ key: `label:${label}`, label, width }))
        : [{ key: NORMAL_KEY, label: t("editorWidth.normal"), width: DEFAULT_EDITOR_WIDTH }];
    return [...steps, { key: FULL_KEY, label: t("editorWidth.full"), width: FULL_EDITOR_WIDTH }];
}
/** Name of the remembered width in the site's browser storage (`lib/utils/site-storage.ts`). */
const STORAGE_NAME = "editor-width";
/**
 * The steps of this site and the chosen one. The choice is remembered in this browser, per site, by step key; a remembered key that no step has any more
 * (the config changed) and unavailable storage both leave the first step.
 */
export function useEditorWidth() {
    const site = useSite();
    const t = useTranslator(editorMessages);
    const configured = site.config.editor?.widths;
    const steps = useMemo(() => resolveEditorWidths(configured, t), [configured, t]);
    const [key, setKey] = useState(null);
    useEffect(() => {
        setKey(readPreference(site, STORAGE_NAME));
    }, [site]);
    const step = steps.find((candidate) => candidate.key === key) ?? steps[0];
    const choose = (next) => {
        setKey(next);
        writePreference(site, STORAGE_NAME, next);
    };
    return { steps, step, choose };
}
/** Body width menu at the right end of the toolbar. */
export function EditorWidthMenu({ steps, value, onChange, }) {
    const t = useTranslator(editorMessages);
    return (_jsxs(DropdownMenu, { children: [_jsx(IconButton, { label: t("editorWidth.label"), side: "bottom", className: "text-cms-muted-foreground", onMouseDown: (event) => event.preventDefault(), trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: _jsx(MoveHorizontal, { "aria-hidden": true, className: "size-4" }) }), _jsx(DropdownMenuContent, { align: "end", className: "min-w-36", children: _jsx(DropdownMenuRadioGroup, { "aria-label": t("editorWidth.label"), value: value.key, onValueChange: (next) => typeof next === "string" && onChange(next), children: steps.map((step) => (_jsx(DropdownMenuRadioItem, { value: step.key, children: step.label }, step.key))) }) })] }));
}
