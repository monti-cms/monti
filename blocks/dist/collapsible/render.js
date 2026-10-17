import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { defineRender } from "@monti-cms/core/render";
import { blockLabels } from "../shared/labels.js";
/** Collapsible. Expands when the title is clicked (it is a `<details>`, so no script is needed). With no title, the default text in the site language is used. */
export function Collapsible({ title, defaultOpen, labels = blockLabels(), children, }) {
    return (_jsxs("details", { className: "monti-block-collapsible", open: defaultOpen || undefined, children: [_jsx("summary", { className: "monti-block-collapsible-summary", children: title?.trim() || labels.collapsibleFallback }), _jsx("div", { className: "monti-block-collapsible-body", children: children })] }));
}
/** Public components for the collapsible in the JSON renderer (`renderDocument`). */
export default defineRender({
    blocks: {
        collapsible: ({ title, defaultOpen, children, ctx }) => (_jsx(Collapsible, { title: title, defaultOpen: defaultOpen, labels: blockLabels(ctx.locale), children: children })),
    },
});
