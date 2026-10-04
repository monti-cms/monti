"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CmsAdminComponentsProvider } from "@monti-cms/admin";
import { addedMarkName, allowsMark, BubbleButton, findAnchor, startLinkFromText, unlinkRef, } from "@monti-cms/admin/editor";
import { cn } from "@monti-cms/admin/kit";
import { createTranslator } from "@monti-cms/core/client";
import { Code2, Unlink } from "lucide-react";
import { codeRefBlock } from "./definition.js";
import { codeRefMessages } from "./messages.js";
const t = createTranslator(codeRefMessages);
/** Editor mark name (`cmsCodeRef`). */
export const CODE_REF_MARK = addedMarkName(codeRefBlock.name);
/** Whether the document has a code block. If not, there is no line to link to, so `Code link` is hidden. */
const hasCodeBlock = (editor) => {
    let found = false;
    editor.state.doc.descendants((node) => {
        if (node.type.name === "codeBlock")
            found = true;
        return !found;
    });
    return found;
};
function CodeRefBubbleButton({ editor, inCode }) {
    if (inCode || !allowsMark(editor.state, CODE_REF_MARK) || !hasCodeBlock(editor))
        return null;
    return (_jsx(BubbleButton, { label: t("link"), onClick: () => {
            const { from, to } = editor.state.selection;
            startLinkFromText(editor.view, from, to);
        }, children: _jsx(Code2, { "aria-hidden": true, className: "size-4" }) }));
}
function CodeRefDetail({ editor, mark, act }) {
    const anchor = findAnchor(editor.state.doc, String(mark.attrs.to ?? ""));
    const where = anchor
        ? `${anchor.title ? `${anchor.title} ` : ""}${anchor.end - anchor.start === 1
            ? t("line.one", { line: anchor.start + 1 })
            : t("line.range", { from: anchor.start + 1, to: anchor.end })}`
        : null;
    return (_jsxs(_Fragment, { children: [_jsx(Code2, { "aria-hidden": true, className: "mx-1 size-4 shrink-0 text-cms-muted-foreground" }), _jsx("span", { className: cn("max-w-56 truncate px-1 text-xs", where ? "text-cms-muted-foreground" : "text-cms-destructive"), children: where ? t("where", { where }) : t("none") }), _jsx(BubbleButton, { label: t("relink"), className: "text-xs", onClick: act(() => startLinkFromText(editor.view, mark.from, mark.to)), children: t("relink.text") }), _jsx(BubbleButton, { label: t("unlink"), onClick: act(() => unlinkRef(editor.view, mark.from, mark.to)), children: _jsx(Unlink, { "aria-hidden": true, className: "size-4" }) })] }));
}
/** Editor registration of the code-ref mark. Shown with an underline in the theme accent color. */
export const codeRefMarkExtension = {
    render: () => ({ class: "underline decoration-cms-primary/60 decoration-solid underline-offset-4" }),
    bubble: { group: "link", order: 1, Button: CodeRefBubbleButton },
    detail: CodeRefDetail,
};
const components = { marks: { [codeRefBlock.name]: codeRefMarkExtension } };
/** Registers the code-ref mark's editor display and bubble in the admin UI. */
export function CodeRefProvider({ children }) {
    return _jsx(CmsAdminComponentsProvider, { components: components, children: children });
}
