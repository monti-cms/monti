import { BulkBar, ListHead, ListScroll, Table, TableBody } from "@monti-cms/ui";
import type * as React from "react";
import { type NoMatchApplied, NoMatchRow } from "./no-match-row";

/**
 * The one place a list's table is put together, so every list is the same table: the box that reaches into the page's margin, the table with the
 * widths of its columns, the bulk bar in the place of the column names while rows are picked (else the column names), the rows, the one answer when
 * a search and filters leave none, and the footer under it. The articles, the tags, people and series, the library's list view, the trash and the
 * activity use it; a screen that draws a table of rows assembles it here (`list-compose` in `scripts/check-parts.mjs`).
 *
 * The rows are the `children`, each screen's own. A footer shared with something else (the library's footer also serves its grid) stays where
 * the screen puts it and is not given here.
 */
export function CollectionTable({
	head,
	bulk,
	noMatch,
	footer,
	tableRef,
	children,
}: {
	/** The column names; their widths are the table's. */
	head: React.ComponentProps<typeof ListHead>;
	/** What the picked rows are asked: shown in place of the column names while it is given. The table's width is its `colSpan`. */
	bulk?: Omit<React.ComponentProps<typeof BulkBar>, "colSpan"> | null;
	/** Given while the search and filters leave no row. */
	noMatch?: { words: string; applied: NoMatchApplied; onClear: () => void } | null;
	footer?: React.ReactNode;
	tableRef?: React.Ref<HTMLTableElement>;
	children?: React.ReactNode;
}) {
	const colSpan = head.columns.length + 1;
	return (
		<>
			<ListScroll>
				<Table
					ref={tableRef}
					container="none"
					layout="fixed"
					columns={[...head.columns.map((column) => column.size), head.end]}
				>
					{bulk ? <BulkBar colSpan={colSpan} {...bulk} /> : <ListHead {...head} />}
					<TableBody>
						{noMatch && <NoMatchRow colSpan={colSpan} {...noMatch} />}
						{children}
					</TableBody>
				</Table>
			</ListScroll>
			{footer}
		</>
	);
}
