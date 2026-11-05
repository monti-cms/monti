import type * as React from "react";
import { cn } from "./cn";
import { HELD } from "./sortable";

/**
 * One item of an ordered list a writer arranges (the posts of a series): a quiet box on the page ground with `handle` (a {@link DragHandle}) first, the
 * item (`children`) and, at the end, `actions` (move up, move down, take out). `drag` carries the sortable's transform while the row is moved; the row
 * being dragged floats above the others.
 */
function OrderedRow({
	handle,
	actions,
	drag,
	className,
	children,
	...props
}: React.ComponentProps<"li"> & {
	handle?: React.ReactNode;
	actions?: React.ReactNode;
	drag?: { transform?: string; transition?: string; active?: boolean };
}) {
	return (
		<li
			data-slot="ordered-row"
			className={cn(
				"flex items-center gap-monti-4 rounded-monti-md border border-monti-muted bg-monti-page p-monti-4 text-monti-caption",
				drag?.active && HELD,
				className,
			)}
			style={drag ? { transform: drag.transform, transition: drag.transition } : undefined}
			{...props}
		>
			{handle}
			<span className="min-w-0 flex-1">{children}</span>
			{actions}
		</li>
	);
}

export { OrderedRow };
