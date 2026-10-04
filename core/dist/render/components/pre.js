import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { showsLineNumbers } from "../code/index.js";
import { CmsCopyButton } from "./copy-button.js";
const parseNotes = (notes) => {
    if (!notes)
        return [];
    try {
        const parsed = JSON.parse(notes);
        return Array.isArray(parsed) ? parsed.map(String) : [];
    }
    catch {
        return [];
    }
};
/**
 * Code block frame (the `<pre>` made by code highlighting). Attaches the title row, copy button, line numbers and the in-code tooltip list, and does not let the attributes
 * the highlighter leaves (`code`, `title`, `lnum`, `notes`) flow into `<pre>` as they are.
 */
export function CmsPre({ children, code, title, lnum, showLineNumbers, notes, className, style, copyLabel = "Copy", copiedLabel = "Copied", notesLabel = "Code notes", }) {
    const numbered = showsLineNumbers({ showLineNumbers, lnum });
    const noteList = parseNotes(notes);
    const path = title?.trim().split("/").filter(Boolean) ?? [];
    return (_jsxs("div", { className: "cms-code", children: [path.length > 0 ? (_jsx("div", { className: "cms-code-title", "data-title": title, children: path.map((part, index) => (_jsxs("span", { className: index === path.length - 1 ? "cms-code-title-file" : undefined, children: [part, index < path.length - 1 ? " / " : ""] }, `${index}-${part}`))) })) : null, _jsx("pre", { className: className, style: style, "data-show-line-numbers": numbered || undefined, children: children }), code ? _jsx(CmsCopyButton, { text: code, label: copyLabel, copiedLabel: copiedLabel }) : null, noteList.length > 0 ? (_jsx("ol", { className: "cms-code-notes", "aria-label": notesLabel, children: noteList.map((note, index) => (_jsxs("li", { children: [_jsx("span", { className: "cms-code-note-number", children: index + 1 }), _jsx("span", { children: note })] }, index))) })) : null] }));
}
