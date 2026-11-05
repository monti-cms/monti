import type * as React from "react";
import { cn } from "./cn";
import { HELD, SLOT } from "./sortable";

const COLUMNS = "grid grid-cols-[14px_minmax(0,1fr)_minmax(0,1fr)_32px] items-center gap-monti-8";

/**
 * The choices of a select as a small table: a head with the two columns (value in mono, label), then one {@link OptionRow} per choice. The value is what is
 * stored and the label is what the writer sees. The rows are the `children`; a button that adds one goes after the table.
 */
function OptionTable({
	valueLabel,
	labelLabel,
	className,
	children,
	...props
}: Omit<React.ComponentProps<"div">, "children"> & {
	valueLabel: string;
	labelLabel: string;
	children?: React.ReactNode;
}) {
	return (
		<div data-slot="option-table" className={cn("flex flex-col", className)} {...props}>
			<div aria-hidden="true" className={cn(COLUMNS, "py-monti-8 text-monti-micro text-monti-subtle")}>
				<span />
				<span>{valueLabel}</span>
				<span>{labelLabel}</span>
				<span />
			</div>
			<ul className="m-0 flex list-none flex-col p-0">{children}</ul>
		</div>
	);
}

/**
 * One choice: `handle` (an {@link DragHandle}) to drag it by, its `value` and `label` (inputs that read as text until focused) and, at the end, `action`
 * (the × that takes it out). `drag` carries the sortable's transform while the row makes room for another, `active` for the gap the row in hand
 * left, and `lifted` for the row in hand itself, drawn by the `Sortable` overlay (it floats on the page ground with the floating shadow). A table
 * whose rows cannot be moved gives no handle.
 */
function OptionRow({
	handle,
	value,
	label,
	action,
	drag,
	className,
	...props
}: Omit<React.ComponentProps<"li">, "children" | "value"> & {
	handle?: React.ReactNode;
	value: React.ReactNode;
	label: React.ReactNode;
	action?: React.ReactNode;
	drag?: { transform?: string; transition?: string; active?: boolean; lifted?: boolean };
}) {
	const Root = (drag?.lifted ? "div" : "li") as "li";
	return (
		<Root
			data-slot="option-row"
			data-held={drag?.active || undefined}
			className={cn(
				COLUMNS,
				// The cells are inputs (32px high, they read as text): 2px above and below make the board's 37px row.
				"border-monti-muted border-b py-monti-2 text-monti-note",
				drag?.active && SLOT,
				drag?.lifted && "border-0",
				drag?.lifted && HELD,
				className,
			)}
			style={drag ? { transform: drag.transform, transition: drag.transition } : undefined}
			{...props}
		>
			<span className="flex text-monti-faint">{handle}</span>
			<span className="min-w-0 font-mono">{value}</span>
			<span className="min-w-0">{label}</span>
			<span className="flex justify-end">{action}</span>
		</Root>
	);
}

export { OptionRow, OptionTable };
