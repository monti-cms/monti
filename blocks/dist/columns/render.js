import { jsx as _jsx } from "react/jsx-runtime";
import { Children, isValidElement } from "react";
import { columnsGridTemplate, parseColumnWidths } from "./layout.js";
/** Columns. Stacked vertically on narrow screens, and side by side on wide screens using the `widths` ratios (equal if absent). */
export function Columns({ widths, children, count }) {
    const columns = count ?? Children.toArray(children).filter(isValidElement).length;
    const style = { "--cms-columns": columnsGridTemplate(parseColumnWidths(widths, columns), columns) };
    return (_jsx("div", { className: "cms-block-columns", style: style, children: children }));
}
/** One column. It is a single element rather than a fragment, so each paragraph inside does not become its own cell. */
export function Column({ children }) {
    return _jsx("div", { className: "cms-block-column", children: children });
}
/** Public components for columns in the JSON renderer (`renderDocument`): the blocks `columns` and `column`. The columns are counted from the stored `column` nodes. */
export const documentComponents = (_context) => ({
    blocks: {
        columns: ({ widths, items, children }) => (_jsx(Columns, { widths: widths, count: items.filter((item) => item.node.type === "column").length, children: children })),
        column: ({ children }) => _jsx(Column, { children: children }),
    },
});
