import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Children } from "react";
import { blockLabels } from "../shared/labels.js";
const VARIANTS = ["note", "tip", "info", "warning", "danger"];
const titleOf = (variant, labels) => ({
    note: labels.calloutNote,
    tip: labels.calloutTip,
    info: labels.calloutInfo,
    warning: labels.calloutWarning,
    danger: labels.calloutDanger,
})[variant];
/** Callout. Wraps the title and body in a box with an accent color per `variant`. An unknown variant falls back to note; a missing title falls back to the variant name. */
export function Callout({ variant, title, labels = blockLabels(), children, }) {
    const kind = VARIANTS.find((item) => item === variant) ?? "note";
    return (_jsxs("div", { className: "cms-block-callout", "data-variant": kind, role: "note", children: [_jsx("div", { className: "cms-block-callout-title", children: title?.trim() || titleOf(kind, labels) }), Children.count(children) > 0 ? _jsx("div", { className: "cms-block-callout-body", children: children }) : null] }));
}
/** Public components for the callout in the JSON renderer (`renderDocument`): the block `callout`, with its attributes as props. */
export const documentComponents = ({ locale }) => {
    const labels = blockLabels(locale);
    return {
        blocks: {
            callout: ({ variant, title, children }) => (_jsx(Callout, { variant: variant, title: title, labels: labels, children: children })),
        },
    };
};
