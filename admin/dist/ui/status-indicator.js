import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cva } from "class-variance-authority";
import { cn } from "../lib/utils/index.js";
const toneClass = cva("shrink-0", {
    variants: {
        tone: {
            success: "text-cms-success",
            warning: "text-cms-warning",
            destructive: "text-cms-destructive",
            neutral: "text-cms-muted-foreground",
        },
        size: {
            /** A bare dot beside a name (language tabs). */
            xs: "size-2",
            /** The dot of the save status. */
            sm: "size-2.5",
            /** The marker of a label in a list column. */
            md: "size-3.5",
        },
    },
    defaultVariants: { tone: "neutral", size: "md" },
});
function Marker({ shape }) {
    switch (shape) {
        case "dot":
            return _jsx("circle", { cx: "8", cy: "8", r: "5.5", fill: "currentColor", stroke: "none" });
        case "ring":
            return _jsx("circle", { cx: "8", cy: "8", r: "5.5" });
        case "dashed":
            return _jsx("circle", { cx: "8", cy: "8", r: "5.5", strokeDasharray: "2.4 2.4" });
        case "half":
            return (_jsxs(_Fragment, { children: [_jsx("circle", { cx: "8", cy: "8", r: "5.5" }), _jsx("path", { d: "M8 2.5a5.5 5.5 0 0 1 0 11z", fill: "currentColor", stroke: "none" })] }));
        case "minus":
            return (_jsxs(_Fragment, { children: [_jsx("circle", { cx: "8", cy: "8", r: "5.5" }), _jsx("path", { d: "M5 8h6" })] }));
    }
}
/**
 * The one status marker of the admin: a small shape in a tone, usually followed by its name. Entry status, delivery state, locale presence,
 * the save status and the language tabs all use it, so a state looks the same wherever it appears.
 */
export function StatusIndicator({ tone = "neutral", shape = "dot", size = "md", label, labelClassName, pulse = false, className, ...props }) {
    return (_jsxs("span", { "data-slot": "status-indicator", "data-tone": tone, className: cn("inline-flex items-center gap-1.5 whitespace-nowrap", label && "text-[13px] text-cms-foreground/80", className), ...props, children: [_jsx("svg", { "aria-hidden": "true", focusable: "false", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.6", className: cn(toneClass({ tone, size }), pulse && "animate-pulse"), children: _jsx(Marker, { shape: shape }) }), label && _jsx("span", { className: labelClassName, children: label })] }));
}
