import { boundedTableSpan, formatTableWidths, hasGfmHeaderLayout, MAX_TABLE_COLUMN_WIDTH, MAX_TABLE_COLUMNS, parseTableWidths, tableCellColumns, tableHasMergedCells, tableWidths, } from "@monti-cms/core/mdx";
import { brDirectiveNode } from "./shared.js";
const tableAttrs = (align, widths) => {
    const attrs = {};
    if (Array.isArray(align))
        attrs.align = align;
    if (widths.length > 0)
        attrs.widths = widths;
    return Object.keys(attrs).length > 0 ? { attrs } : {};
};
export const tableConverter = {
    name: "table",
    cmsTypes: ["table"],
    tiptapTypes: ["table"],
    // A GFM table holds only inline content per cell.
    isMappable: (node, ctx) => (node.content ?? []).every((row) => row.type === "tableRow" &&
        (row.content ?? []).every((cell) => cell.type === "tableCell" && (cell.content ?? []).every(ctx.isMappableInline))),
    toTiptap: (node, ctx) => {
        const rows = node.content ?? [];
        const hasMerges = tableHasMergedCells(node);
        const widths = tableWidths(node);
        const columns = tableCellColumns(rows.map((row) => row.content ?? []));
        return {
            type: "table",
            ...(Array.isArray(node.attrs?.align) ? { attrs: { align: node.attrs.align } } : {}),
            content: rows.map((row, rowIndex) => ({
                type: "tableRow",
                content: (row.content ?? []).map((cell, cellIndex) => {
                    const isHeader = cell.attrs?.header === true || (!hasMerges && cell.attrs?.header === undefined && rowIndex === 0);
                    const colspan = boundedTableSpan(cell.attrs?.colspan, MAX_TABLE_COLUMNS);
                    const rowspan = boundedTableSpan(cell.attrs?.rowspan, rows.length - rowIndex);
                    const attrs = {};
                    if (colspan > 1)
                        attrs.colspan = colspan;
                    if (rowspan > 1)
                        attrs.rowspan = rowspan;
                    // Split the table's column widths into prosemirror-tables colwidth per column each cell covers (0 is auto).
                    const start = columns[rowIndex]?.[cellIndex] ?? 0;
                    const colwidth = Array.from({ length: colspan }, (_, index) => widths[start + index] ?? 0);
                    if (colwidth.some((width) => width > 0))
                        attrs.colwidth = colwidth;
                    return {
                        type: isHeader ? "tableHeader" : "tableCell",
                        ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
                        content: [{ type: "paragraph", content: ctx.inlineToTiptap(cell.content ?? []) }],
                    };
                }),
            })),
        };
    },
    toCms: (node, ctx) => {
        const rows = node.content ?? [];
        // Check whether there are merged cells. If so, keep the header attribute; if not, follow GFM rules.
        const hasMerges = tableHasMergedCells(node);
        // Gather each cell's colwidth into a list of table widths per grid column.
        const columns = tableCellColumns(rows.map((row) => row.content ?? []));
        const collected = [];
        rows.forEach((row, rowIndex) => {
            (row.content ?? []).forEach((cell, cellIndex) => {
                const colwidth = Array.isArray(cell.attrs?.colwidth) ? cell.attrs.colwidth : [];
                const start = columns[rowIndex]?.[cellIndex] ?? 0;
                colwidth.forEach((width, index) => {
                    if (typeof width === "number" && width > 0)
                        collected[start + index] ??= Math.min(MAX_TABLE_COLUMN_WIDTH, Math.round(width));
                });
            });
        });
        const widths = parseTableWidths(formatTableWidths(Array.from(collected)));
        const directive = hasMerges || widths.length > 0;
        const explicitHeaders = hasMerges ||
            !hasGfmHeaderLayout(rows.map((row) => (row.content ?? []).map((cell) => cell.type === "tableHeader")));
        return [
            {
                type: "table",
                ...tableAttrs(node.attrs?.align, widths),
                content: rows.map((row) => ({
                    type: "tableRow",
                    content: (row.content ?? []).map((cell) => {
                        // Multiple paragraphs in a cell cannot go into a GFM table, so they are joined with line breaks.
                        const paragraphs = (cell.content ?? []).map((block) => ctx.inlineToCms(block.content));
                        const inline = paragraphs.flatMap((content, index) => index === 0 ? content : [brDirectiveNode(), ...content]);
                        const colspan = Number(cell.attrs?.colspan ?? 1);
                        const rowspan = Number(cell.attrs?.rowspan ?? 1);
                        const isHeader = cell.type === "tableHeader";
                        const attrs = {};
                        if (colspan > 1)
                            attrs.colspan = colspan;
                        if (rowspan > 1)
                            attrs.rowspan = rowspan;
                        // For merged or column-width tables, only the header is stated; for non-GFM header layouts, whether each cell is a header is stated explicitly.
                        // A GFM first-row-header table leaves the attribute empty to preserve the existing bytes.
                        if (directive && isHeader)
                            attrs.header = true;
                        else if (explicitHeaders && !directive)
                            attrs.header = isHeader;
                        return {
                            type: "tableCell",
                            ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
                            content: inline,
                        };
                    }),
                })),
            },
        ];
    },
};
