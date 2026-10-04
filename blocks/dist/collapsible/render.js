import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { blockLabels } from "../shared/labels.js";
/** Collapsible. Expands when the title is clicked (it is a `<details>`, so no script is needed). With no title, the default text in the site language is used. */
export function Collapsible({ title, defaultOpen, labels = blockLabels(), children, }) {
    return (_jsxs("details", { className: "cms-block-collapsible", open: defaultOpen || undefined, children: [_jsx("summary", { className: "cms-block-collapsible-summary", children: title?.trim() || labels.collapsibleFallback }), _jsx("div", { className: "cms-block-collapsible-body", children: children })] }));
}
/** Public component for the collapsible (called by `@monti-cms/core/render`). */
export default ({ locale }) => {
    const labels = blockLabels(locale);
    return { Collapsible: (props) => _jsx(Collapsible, { ...props, labels: labels }) };
};
