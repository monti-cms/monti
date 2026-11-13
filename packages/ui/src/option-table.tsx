import type * as React from "react";
import { cn } from "./cn";
import { IconButtonContext } from "./icon-button";
import { HELD, SLOT } from "./sortable";

const SMALL = { size: "sm" } as const;

const COLUMNS = "grid grid-cols-[14px_minmax(0,1fr)_minmax(0,1fr)_32px] items-center gap-monti-8";

/**
 * The choices of a select as a small table: one {@link OptionRow} per choice, with no head. The value (mono) is what is stored and the label is what the
 * writer sees; while empty, each input says which it is by its placeholder. The rows are the `children`; a button that adds one goes after the table.
 */
function OptionTable({
	className,
	children,
	...props
}: Omit<React.ComponentProps<"ul">, "children"> & { children?: React.ReactNode }) {
	return (
		<ul data-slot="option-table" className={cn("m-0 flex list-none flex-col p-0", className)} {...props}>
			{children}
		</ul>
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
				// The cells are inline inputs with no height of their own: the row stands at a control's height (32px, as in sheets and side panels).
				"min-h-monti-control-md border-monti-muted border-b text-monti-note",
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
			{/* The × is one step under the 32px row (28px), as a button inside a field is (field.md): it does not fill the row. */}
			<span className="flex justify-end">
				<IconButtonContext.Provider value={SMALL}>{action}</IconButtonContext.Provider>
			</span>
		</Root>
	);
}

export { OptionRow, OptionTable };
