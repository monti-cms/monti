import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Children, useId } from "react";
const dropLeadingNewline = (lines) => {
    const first = lines[0];
    if (typeof first !== "string" || !first.startsWith("\n"))
        return lines;
    const trimmed = first.slice(1);
    return trimmed ? [trimmed, ...lines.slice(1)] : lines.slice(1);
};
/** Code line folding (the `collapse` line effect). The first line is the title and the rest show when expanded. */
export function CmsCodeCollapse({ children, open }) {
    const nodes = Children.toArray(children);
    let first = 0;
    while (first < nodes.length && typeof nodes[first] === "string" && nodes[first].trim() === "")
        first += 1;
    const lines = nodes.slice(first);
    const rest = dropLeadingNewline(lines.slice(1));
    return (_jsxs("details", { className: "cms-code-collapse", open: open, children: [_jsx("summary", { children: lines[0] ?? null }), rest.length > 0 ? _jsx("div", { children: rest }) : null] }));
}
/** Folding text inside code (the `fold` line effect). Clicking `...` expands it (no script needed). */
export function CmsCodeFold({ children, open, label = "Show folded code", }) {
    const id = useId();
    return (_jsxs("span", { className: "cms-code-fold", children: [_jsx("input", { id: id, type: "checkbox", "aria-label": label, defaultChecked: open }), _jsx("label", { htmlFor: id, className: "cms-code-fold-closed", children: "..." }), _jsx("label", { htmlFor: id, className: "cms-code-fold-open", children: children })] }));
}
