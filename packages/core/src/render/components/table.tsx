import * as React from "react";
import { boundedTableSpan, MAX_TABLE_COLUMNS, parseTableWidths } from "../../doc/table-layout";

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

/**
 * Body table that supports cell merging (colspan, rowspan). Moved from the reference blog's public page.
 * Column alignment (`align="left,center,right"`) is distributed automatically to match each cell's grid position.
 */
const isHeaderValue = (header: unknown) => header === true || header === "true" || header === "";

type PlacedCell = { element: React.ReactElement; colIndex: number; colSpan: number; rowSpan: number };

export function CmsTable({ align, widths, className, children, ...props }: TableProps) {
	const alignments = align ? align.split(",").map((s) => s.trim()) : [];

	// First compute each cell's column position in the table grid. Column alignment and the first/last column padding use this position.
	const rowList = React.Children.toArray(children);
	const grid: boolean[][] = [];

	const placedRows = rowList.map((rowElement, rowIndex) => {
		if (!React.isValidElement(rowElement)) return { row: rowElement, cells: null, isHeader: false };
		const rowChildren = React.Children.toArray((rowElement.props as { children?: React.ReactNode }).children);
		let colIndex = 0;
		const cells = rowChildren.map((cellElement) => {
			if (!React.isValidElement(cellElement)) return cellElement;
			while (grid[rowIndex]?.[colIndex]) {
				colIndex += 1;
			}
			const cellProps = cellElement.props as TableCellProps;
			const colSpan = boundedTableSpan(cellProps.colspan ?? cellProps.colSpan, MAX_TABLE_COLUMNS - colIndex);
			const rowSpan = boundedTableSpan(cellProps.rowspan ?? cellProps.rowSpan, rowList.length - rowIndex);
			for (let r = 0; r < rowSpan; r += 1) {
				for (let c = 0; c < colSpan; c += 1) {
					if (!grid[rowIndex + r]) grid[rowIndex + r] = [];
					grid[rowIndex + r][colIndex + c] = true;
				}
			}
			const placed: PlacedCell = { element: cellElement, colIndex, colSpan, rowSpan };
			colIndex += colSpan;
			return placed;
		});
		const isHeader =
			rowIndex === 0 &&
			cells.every(
				(cell) =>
					typeof cell === "object" &&
					cell !== null &&
					"colIndex" in cell &&
					isHeaderValue((cell.element.props as TableCellProps).header),
			);
		return { row: rowElement, cells, isHeader };
	});

	const columnCount = Math.max(0, ...grid.map((row) => row.length));
	// If the whole first row is headers and nothing merges downward, put it in thead like a GFM table (same prose style).
	const headRow = placedRows[0];
	const hasHead =
		!!headRow?.isHeader &&
		!!headRow.cells?.every(
			(cell) => typeof cell === "object" && cell !== null && "rowSpan" in cell && cell.rowSpan === 1,
		);

	const enrichedRows = placedRows.map(({ row, cells, isHeader }) => {
		if (!cells || !React.isValidElement(row)) return row;
		const enrichedCells = cells.map((cell) => {
			if (typeof cell !== "object" || cell === null || !("colIndex" in cell)) return cell;
			const { element, colIndex, colSpan, rowSpan } = cell;
			const cellProps = element.props as TableCellProps;
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
			} as Record<string, unknown>);
		});
		return React.cloneElement(row, { children: enrichedCells } as Record<string, unknown>);
	});

	// Same as the editor (prosemirror-tables): if all column widths are known, use the total width; if only some, use a minimum width.
	const columnWidths = parseTableWidths(widths);
	const knownWidths = Array.from({ length: columnCount }, (_, index) => columnWidths[index] ?? null);
	const totalWidth = knownWidths.reduce<number>((sum, width) => sum + (width ?? 0), 0);
	const tableStyle: React.CSSProperties | undefined =
		columnWidths.length === 0 || columnCount === 0
			? undefined
			: knownWidths.every((width) => width !== null)
				? { width: totalWidth, maxWidth: "none" }
				: { minWidth: totalWidth };

	// No border or background is set separately. It takes the same prose table style as a default (GFM) table.
	return (
		<div className="cms-table-scroll">
			<table
				className={["cms-table", tableStyle?.width ? null : "cms-table-full", className].filter(Boolean).join(" ")}
				style={tableStyle}
				{...props}
			>
				{columnWidths.length > 0 && columnCount > 0 ? (
					<colgroup>
						{knownWidths.map((width, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: the column position is the identifier.
							<col key={index} style={width ? { width } : undefined} />
						))}
					</colgroup>
				) : null}
				{hasHead ? <thead>{enrichedRows[0]}</thead> : null}
				<tbody>{hasHead ? enrichedRows.slice(1) : enrichedRows}</tbody>
			</table>
		</div>
	);
}

export function CmsTableRow({ className, children, ...props }: TableRowProps) {
	return (
		<tr className={className} {...props}>
			{children}
		</tr>
	);
}

export function CmsTableCell({
	header,
	colspan,
	rowspan,
	colSpan,
	rowSpan,
	align,
	firstColumn,
	lastColumn,
	inHead,
	className,
	children,
	scope,
	...props
}: TableCellProps) {
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

	return (
		<Tag
			colSpan={Number(colspan ?? colSpan) > 1 ? Number(colspan ?? colSpan) : undefined}
			rowSpan={Number(rowspan ?? rowSpan) > 1 ? Number(rowspan ?? rowSpan) : undefined}
			scope={isHeader ? scope : undefined}
			className={classes}
			{...props}
		>
			{children}
		</Tag>
	);
}
