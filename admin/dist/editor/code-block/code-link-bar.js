"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createTranslator } from "@monti-cms/core/client";
import { useEditorState } from "@tiptap/react";
import { Code2 } from "lucide-react";
import { Button } from "../../ui/button.js";
import { codeEffectsKey } from "./effects-plugin.js";
import { cancelLink, commitLink, linkLines, linkTextRange } from "./link-commands.js";
import { codeBlockMessages } from "./messages.js";
const t = createTranslator(codeBlockMessages);
const lineLabel = (lines) => lines.end - lines.start === 1
    ? t("linkBar.line", { line: lines.start + 1 })
    : t("linkBar.lineRange", { start: lines.start + 1, end: lines.end });
/**
 * Guide line shown below the formatting tools while linking body text to code. Shows the side picked first, and turns on "Link" once the other side is picked.
 * Ends with Esc or "Cancel".
 */
export function CodeLinkBar({ editor }) {
    const status = useEditorState({
        editor,
        selector: ({ editor: current }) => {
            const state = current ? codeEffectsKey.getState(current.state) : undefined;
            if (!current || !state?.linking)
                return null;
            const text = linkTextRange(current.view);
            const lines = linkLines(current.view);
            return {
                kind: state.linking.kind,
                text: text ? current.state.doc.textBetween(text.from, text.to, " ") : null,
                lines: lines ? { start: lines.start, end: lines.end } : null,
            };
        },
    });
    if (!status)
        return null;
    const ready = !!status.text && !!status.lines;
    const quoted = status.text ? `“${status.text.length > 24 ? `${status.text.slice(0, 24)}…` : status.text}”` : "";
    return (_jsxs("div", { role: "status", "aria-label": t("linkBar.label"), className: "flex w-full flex-wrap items-center justify-center gap-2 border-t bg-cms-primary/5 px-4 py-1.5 text-xs", children: [_jsx(Code2, { "aria-hidden": true, className: "size-4 shrink-0 text-cms-primary" }), _jsx("span", { className: "min-w-0", children: status.kind === "text" ? (_jsxs(_Fragment, { children: [t("linkBar.pickLinesBefore"), _jsx("b", { children: quoted }), t("linkBar.pickLinesAfter"), status.lines && _jsxs("b", { className: "ml-1 text-cms-primary", children: ["\u00B7 ", lineLabel(status.lines)] })] })) : (_jsxs(_Fragment, { children: [t("linkBar.pickTextBefore"), _jsx("b", { children: t("linkBar.codeLines", { lines: status.lines ? lineLabel(status.lines) : "" }) }), t("linkBar.pickTextAfter"), status.text && _jsxs("b", { className: "ml-1 text-cms-primary", children: ["\u00B7 ", quoted] })] })) }), _jsxs("div", { className: "flex gap-1", children: [_jsx(Button, { type: "button", size: "xs", disabled: !ready, onMouseDown: (event) => event.preventDefault(), onClick: () => commitLink(editor.view), children: t("linkBar.link") }), _jsx(Button, { type: "button", variant: "outline", size: "xs", onMouseDown: (event) => event.preventDefault(), onClick: () => cancelLink(editor.view), children: t("linkBar.cancel") })] })] }));
}
