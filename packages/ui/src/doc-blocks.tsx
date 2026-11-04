import type * as React from "react";
import { cn } from "./cn";

/**
 * The blocks of an entry drawn where it is read, not edited (a translation's source beside it, a side-by-side row): a callout, a code block and a table,
 * in the inner box the editor draws them in. `source` sets them one step darker, on the source's tool ground.
 */
const DOC_BOX = "rounded-monti-lg px-monti-16 py-monti-12";

/** A callout: its first line (its title) bold, its lines 8px apart. */
function DocCallout({ source = false, className, ...props }: React.ComponentProps<"div"> & { source?: boolean }) {
	return (
		<div
			data-slot="doc-callout"
			className={cn(
				DOC_BOX,
				"flex flex-col gap-monti-8 *:first:font-bold",
				source ? "bg-monti-selected" : "bg-monti-muted",
				className,
			)}
			{...props}
		/>
	);
}

/** Code as it is: fixed-width, at the caption size, its lines kept; it scrolls sideways when a line is long. */
function DocCode({ source = false, className, ...props }: React.ComponentProps<"pre"> & { source?: boolean }) {
	return (
		<pre
			data-slot="doc-code"
			className={cn(
				DOC_BOX,
				"m-0 overflow-x-auto font-mono text-monti-caption leading-[1.7]",
				source ? "bg-monti-selected" : "bg-monti-muted",
				className,
			)}
			{...props}
		/>
	);
}

/** A table: its head cells bold over a darker line, each row on a hairline; a `number` cell is fixed-width. */
function DocTable({
	head,
	rows,
	className,
}: {
	head: readonly string[];
	rows: readonly (readonly string[])[];
	className?: string;
}) {
	const cell = "border-monti-muted border-b px-monti-8 py-monti-6 text-left";
	return (
		<table data-slot="doc-table" className={cn("w-full border-collapse text-monti-body", className)}>
			<thead>
				<tr>
					{head.map((name) => (
						<th key={name} className={cn(cell, "border-monti-default font-semibold")}>
							{name}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{rows.map((row) => (
					<tr key={row.join("\t")}>
						{row.map((value, index) => (
							<td key={index} className={cn(cell, /^\d[\d.,]*$/.test(value) && "font-mono text-monti-caption")}>
								{value}
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
}

export { DocCallout, DocCode, DocTable };
