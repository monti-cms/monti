import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { boundedTableSpan, MAX_TABLE_COLUMNS, parseTableWidths } from "../../mdx/table-layout.js";
/**
 * Body table that supports cell merging (colspan, rowspan). Moved from the reference blog's public page.
 * Column alignment (`align="left,center,right"`) is distributed automatically to match each cell's grid position.
 */
const isHeaderValue = (header) => header === true || header === "true" || header === "";
export function CmsTable({ align, widths, className, children, ...props }) {
    const alignments = align ? align.split(",").map((s) => s.trim()) : [];
    // First compute each cell's column position in the table grid. Column alignment and the first/last column padding use this position.
    const rowList = React.Children.toArray(children);
    const grid = [];
    const placedRows = rowList.map((rowElement, rowIndex) => {
        if (!React.isValidElement(rowElement))
            return { row: rowElement, cells: null, isHeader: false };
        const rowChildren = React.Children.toArray(rowElement.props.children);
        let colIndex = 0;
        const cells = rowChildren.map((cellElement) => {
            if (!React.isValidElement(cellElement))
                return cellElement;
            while (grid[rowIndex]?.[colIndex]) {
                colIndex += 1;
            }
            const cellProps = cellElement.props;
            const colSpan = boundedTableSpan(cellProps.colspan ?? cellProps.colSpan, MAX_TABLE_COLUMNS - colIndex);
            const rowSpan = boundedTableSpan(cellProps.rowspan ?? cellProps.rowSpan, rowList.length - rowIndex);
            for (let r = 0; r < rowSpan; r += 1) {
                for (let c = 0; c < colSpan; c += 1) {
                    if (!grid[rowIndex + r])
                        grid[rowIndex + r] = [];
                    grid[rowIndex + r][colIndex + c] = true;
                }
            }
            const placed = { element: cellElement, colIndex, colSpan, rowSpan };
            colIndex += colSpan;
            return placed;
        });
        const isHeader = rowIndex === 0 &&
            cells.every((cell) => typeof cell === "object" &&
                cell !== null &&
                "colIndex" in cell &&
                isHeaderValue(cell.element.props.header));
        return { row: rowElement, cells, isHeader };
    });
    const columnCount = Math.max(0, ...grid.map((row) => row.length));
    // If the whole first row is headers and nothing merges downward, put it in thead like a GFM table (same prose style).
    const headRow = placedRows[0];
    const hasHead = !!headRow?.isHeader &&
        !!headRow.cells?.every((cell) => typeof cell === "object" && cell !== null && "rowSpan" in cell && cell.rowSpan === 1);
    const enrichedRows = placedRows.map(({ row, cells, isHeader }) => {
        if (!cells || !React.isValidElement(row))
            return row;
        const enrichedCells = cells.map((cell) => {
            if (typeof cell !== "object" || cell === null || !("colIndex" in cell))
                return cell;
            const { element, colIndex, colSpan, rowSpan } = cell;
            const cellProps = element.props;
            // Link only to the current cell's column and row, not the whole group. colspan and rowspan are handled by HTML's header assignment.
            const scope = isHeaderValue(cellProps.header) ? (cellProps.scope ?? (isHeader ? "col" : "row")) : cellProps.scope;
            return React.cloneElement(element, {
                align: cellProps.align ?? (alignments[colIndex] || undefined),
                scope,
                colspan: colSpan,
                rowspan: rowSpan,
                firstColumn: colIndex === 0,
                lastColumn: colIndex + colSpan >= columnCount,
                inHead: hasHead && isHeader,
            });
        });
        return React.cloneElement(row, { children: enrichedCells });
    });
    // Same as the editor (prosemirror-tables): if all column widths are known, use the total width; if only some, use a minimum width.
    const columnWidths = parseTableWidths(widths);
    const knownWidths = Array.from({ length: columnCount }, (_, index) => columnWidths[index] ?? null);
    const totalWidth = knownWidths.reduce((sum, width) => sum + (width ?? 0), 0);
    const tableStyle = columnWidths.length === 0 || columnCount === 0
        ? undefined
        : knownWidths.every((width) => width !== null)
            ? { width: totalWidth, maxWidth: "none" }
            : { minWidth: totalWidth };
    // No border or background is set separately. It takes the same prose table style as a default (GFM) table.
    return (_jsx("div", { className: "cms-table-scroll", children: _jsxs("table", { className: ["cms-table", tableStyle?.width ? null : "cms-table-full", className].filter(Boolean).join(" "), style: tableStyle, ...props, children: [columnWidths.length > 0 && columnCount > 0 ? (_jsx("colgroup", { children: knownWidths.map((width, index) => (_jsx("col", { style: width ? { width } : undefined }, index))) })) : null, hasHead ? _jsx("thead", { children: enrichedRows[0] }) : null, _jsx("tbody", { children: hasHead ? enrichedRows.slice(1) : enrichedRows })] }) }));
}
export function CmsTableRow({ className, children, ...props }) {
    return (_jsx("tr", { className: className, ...props, children: children }));
}
export function CmsTableCell({ header, colspan, rowspan, colSpan, rowSpan, align, firstColumn, lastColumn, inHead, className, children, scope, ...props }) {
    const isHeader = isHeaderValue(header);
    const Tag = isHeader ? "th" : "td";
    const classes = [
        "cms-table-cell",
        inHead && "cms-table-cell-head",
        firstColumn && "cms-table-cell-first",
        lastColumn && "cms-table-cell-last",
        isHeader && "cms-table-cell-header",
        align === "center" || align === "right" || align === "left" ? `cms-align-${align}` : null,
        className,
    ]
        .filter(Boolean)
        .join(" ");
    return (_jsx(Tag, { colSpan: Number(colspan ?? colSpan) > 1 ? Number(colspan ?? colSpan) : undefined, rowSpan: Number(rowspan ?? rowSpan) > 1 ? Number(rowspan ?? rowSpan) : undefined, scope: isHeader ? scope : undefined, className: classes, ...props, children: children }));
}
