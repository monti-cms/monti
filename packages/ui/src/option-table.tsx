import type * as React from "react";
import { cn } from "./cn";
import { Grip } from "./grip";

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
 * One choice: `handle` (an {@link OptionRowHandle}) to drag it by, its `value` and `label` (inputs that read as text until focused) and, at the end, `action`
 * (the × that takes it out). `drag` carries the sortable's transform while the row is moved. A table whose rows cannot be moved gives no handle.
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
	drag?: { transform?: string; transition?: string; active?: boolean };
}) {
	return (
		<li
			data-slot="option-row"
			className={cn(
				COLUMNS,
				// The cells are inputs (32px high, they read as text): 2px above and below make the board's 37px row.
				"border-monti-muted border-b py-monti-2 text-monti-note",
				drag?.active && "relative z-10 bg-monti-tool opacity-80",
				className,
			)}
			style={drag ? { transform: drag.transform, transition: drag.transition } : undefined}
			{...props}
		>
			<span className="flex text-monti-faint">{handle}</span>
			<span className="min-w-0 font-mono">{value}</span>
			<span className="min-w-0">{label}</span>
			<span className="flex justify-end">{action}</span>
		</li>
	);
}

/** The drag handle of an {@link OptionRow}: six dots in the row's first column. Give it the sortable's `ref` and listeners, and a name that says whose row it moves. */
function OptionRowHandle({ className, ...props }: Omit<React.ComponentProps<"button">, "children" | "type">) {
	return (
		<button
			type="button"
			data-slot="option-row-handle"
			className={cn(
				"flex cursor-grab touch-none items-center justify-center rounded-monti-sm border-0 bg-transparent p-0 text-monti-faint outline-none hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/20",
				className,
			)}
			{...props}
		>
			<Grip />
		</button>
	);
}

export { OptionRow, OptionRowHandle, OptionTable };
