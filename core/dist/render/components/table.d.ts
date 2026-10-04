import * as React from "react";
export interface TableProps extends Omit<React.ComponentProps<"table">, "align"> {
    align?: string;
    /** Comma-separated list of column widths (px). An empty cell means automatic width. */
    widths?: string;
    children?: React.ReactNode;
}
export interface TableRowProps extends React.ComponentProps<"tr"> {
    children?: React.ReactNode;
}
export interface TableCellProps extends Omit<React.ComponentProps<"td">, "align"> {
    header?: boolean | string;
    colspan?: number | string;
    rowspan?: number | string;
    align?: string;
    /** Filled in by Table from the grid position. The first and last columns have no outer padding, like GFM tables. */
    firstColumn?: boolean;
    lastColumn?: boolean;
    /** A cell inside the header row (thead). */
    inHead?: boolean;
    children?: React.ReactNode;
}
export declare function CmsTable({ align, widths, className, children, ...props }: TableProps): React.JSX.Element;
export declare function CmsTableRow({ className, children, ...props }: TableRowProps): React.JSX.Element;
export declare function CmsTableCell({ header, colspan, rowspan, colSpan, rowSpan, align, firstColumn, lastColumn, inHead, className, children, scope, ...props }: TableCellProps): React.JSX.Element;
