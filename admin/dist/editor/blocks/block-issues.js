"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { useBlockIssues } from "./block-issues-context.js";
import { blocksMessages } from "./messages.js";
/** The warnings of a block, under it. Not editable text: it stays out of the document. */
export function BlockIssueNotice({ blockId }) {
    const t = useTranslator(blocksMessages);
    const texts = useBlockIssues(blockId);
    if (texts.length === 0)
        return null;
    return (_jsx("ul", { contentEditable: false, "data-cms-block-issues": "", "aria-label": t("issues.label"), className: "not-prose m-0 list-none space-y-1 border-amber-500/40 border-t bg-amber-500/10 px-3 py-2 cms-dark:text-amber-400 text-amber-800 text-xs", children: texts.map((text) => (_jsxs("li", { className: "flex items-start gap-1.5", children: [_jsxs("svg", { "aria-hidden": true, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className: "mt-0.5 size-3.5 shrink-0", children: [_jsx("path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" }), _jsx("path", { d: "M12 9v4" }), _jsx("path", { d: "M12 17h.01" })] }), _jsx("span", { className: "min-w-0 break-words", children: text })] }, text))) }));
}
