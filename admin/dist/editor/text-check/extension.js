"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { DEFAULT_LOCALE } from "@monti-cms/core/client";
import { useState } from "react";
import { TextCheckToolbar, TextIssuePopover } from "./text-check-controls.js";
import { useTextCheck } from "./use-text-check.js";
/**
 * Text check (spelling, etc.) UI. When an extension adds a checker to the admin extension point `textCheckers`, each checker gets a toolbar button,
 * and results are shown as wavy underlines, a results panel, and a list. The core has no checkers of its own, and if no checker
 * covers the text's language, it renders nothing.
 */
export function useTextCheckEditor(checkers, context) {
    const [editor, setEditor] = useState(null);
    const locale = context.getEntry?.().locale ?? DEFAULT_LOCALE;
    const controller = useTextCheck(editor, { checkers, locale });
    return {
        onEditor: setEditor,
        toolbar: controller ? _jsx(TextCheckToolbar, { controller: controller }) : null,
        overlay: controller ? _jsx(TextIssuePopover, { controller: controller }) : null,
    };
}
