import { jsx as _jsx } from "react/jsx-runtime";
import { Children, isValidElement } from "react";
import { columnsGridTemplate, parseColumnWidths } from "./layout.js";
/** Columns. Stacked vertically on narrow screens, and side by side on wide screens using the `widths` ratios (equal if absent). */
export function Columns({ widths, children }) {
    const count = Children.toArray(children).filter(isValidElement).length;
    const style = { "--cms-columns": columnsGridTemplate(parseColumnWidths(widths, count), count) };
    return (_jsx("div", { className: "cms-block-columns", style: style, children: children }));
}
/** One column. It is a single element rather than a fragment, so each paragraph inside does not become its own cell. */
export function Column({ children }) {
    return _jsx("div", { className: "cms-block-column", children: children });
}
/** Public component for columns (called by `@monti-cms/core/render`). */
export default () => ({ Columns, Column });
