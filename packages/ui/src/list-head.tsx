"use client";

import { ArrowDown, ArrowUp } from "@carbon/icons-react";
import * as React from "react";
import { cn } from "./cn";
import { TableHead, TableHeader } from "./table";

/** One column of a list as its head names it. */
type ListHeadColumn = {
	id: string;
	label: string;
	/** Width in px; without it the column takes the room the others leave (the title). */
	size?: number;
	align?: "start" | "end";
	/** How the list is sorted by this column: `null` when it can sort the list but does not, `undefined` when it cannot sort it. */
	sort?: "asc" | "desc" | null;
};

/** The order shown while `id` is held over `over`: it takes the place of the column it is over, and the columns between shift by one. */
function placePreview(order: readonly string[], id: string, over: string): string[] {
	const target = order.indexOf(over);
	if (target < 0 || id === over) return [...order];
	const next = order.filter((candidate) => candidate !== id);
	next.splice(target, 0, id);
	return next;
}

/** How far the pointer moves before a press on a name becomes a drag rather than a click. */
const DRAG_START = 4;

/**
 * The head row of a list: the name of each column, and an empty cell over the ⋯. A name that can sort the list sorts it when pressed (again, the
 * other way); the column the list is sorted by shows its name in ink with ↓ or ↑. Any name can be dragged sideways: it lifts and follows the pointer
 * while the other columns make room, and letting go calls `onPlace(from, to)` with the column whose place it took. `onPreview` gets the order shown
 * while dragging (`null` after), so the rows follow it. Alt with ← or → on a focused name calls `onStep(id, -1 | 1)`.
 */
function ListHead({
	columns,
	end,
	moveLabel,
	onSort,
	onPlace,
	onStep,
	onPreview,
}: {
	/** The columns shown, in order. */
	columns: readonly ListHeadColumn[];
	/** The width of the empty cell at the end, over the rows' ⋯. */
	end?: number;
	/** What each name's description says about moving it ("Alt+← → moves the column"). */
	moveLabel: string;
	onSort: (id: string) => void;
	onPlace: (from: string, to: string) => void;
	onStep: (id: string, direction: -1 | 1) => void;
	onPreview?: (order: string[] | null) => void;
}) {
	const row = React.useRef<HTMLTableRowElement>(null);
	// The press in progress: where it started, where on the name it took hold, and the order when it started.
	const press = React.useRef<{ id: string; x: number; grab: number; ids: string[] } | null>(null);
	const [drag, setDrag] = React.useState<{ id: string; offset: number } | null>(null);
	const dragged = React.useRef(false);
	const pointerX = React.useRef(0);
	const ids = columns.map((column) => column.id);
	const cellOf = (id: string) =>
		[...(row.current?.querySelectorAll<HTMLElement>("[data-column]") ?? [])].find((cell) => cell.dataset.column === id);
	/** How far the held name must be moved off its place (as laid out now) to sit under the pointer. */
	const lift = (id: string, offset: number) => {
		const cell = cellOf(id);
		if (!cell || !press.current) return 0;
		return pointerX.current - press.current.grab - (cell.getBoundingClientRect().left - offset);
	};
	// After the columns took their new order, keep the held name under the pointer.
	const order = ids.join();
	React.useLayoutEffect(() => {
		if (!drag) return;
		const offset = lift(drag.id, drag.offset);
		if (offset !== drag.offset) setDrag({ ...drag, offset });
	}, [order]);

	const finish = (commit: boolean) => {
		const held = press.current;
		press.current = null;
		if (!drag) return;
		if (held && commit) {
			const to = held.ids[ids.indexOf(held.id)];
			if (to !== undefined && to !== held.id) onPlace(held.id, to);
		}
		onPreview?.(null);
		setDrag(null);
	};

	return (
		<TableHeader>
			<tr
				ref={row}
				onPointerMove={(event) => {
					const held = press.current;
					if (!held) return;
					pointerX.current = event.clientX;
					if (!drag) {
						if (Math.abs(event.clientX - held.x) < DRAG_START) return;
						event.currentTarget.setPointerCapture?.(event.pointerId);
						dragged.current = true;
						setDrag({ id: held.id, offset: lift(held.id, 0) });
						return;
					}
					const over = ids.find((id) => {
						if (id === held.id) return false;
						const box = cellOf(id)?.getBoundingClientRect();
						return box !== undefined && event.clientX >= box.left && event.clientX < box.right;
					});
					if (over === undefined) setDrag({ ...drag, offset: lift(held.id, drag.offset) });
					else onPreview?.(placePreview(ids, held.id, over));
				}}
				onPointerUp={() => finish(true)}
				onPointerCancel={() => finish(false)}
			>
				{columns.map((column) => {
					const held = drag?.id === column.id;
					const sortable = column.sort !== undefined;
					return (
						<TableHead
							key={column.id}
							data-column={column.id}
							data-held={held ? "" : undefined}
							size={column.size}
							align={column.align}
							aria-sort={column.sort === "asc" ? "ascending" : column.sort === "desc" ? "descending" : undefined}
							className="relative touch-none select-none font-normal data-held:z-1 data-held:bg-monti-selected data-held:shadow-monti-floating"
							style={held ? { transform: `translateX(${drag.offset}px)` } : undefined}
							onPointerDown={(event) => {
								if (event.button !== 0) return;
								const box = event.currentTarget.getBoundingClientRect();
								press.current = { id: column.id, x: event.clientX, grab: event.clientX - box.left, ids };
								pointerX.current = event.clientX;
								dragged.current = false;
							}}
						>
							<button
								type="button"
								aria-description={moveLabel}
								className={cn(
									"inline-flex max-w-full cursor-grab items-center gap-monti-4 border-0 bg-transparent p-0 font-normal text-inherit outline-none focus-visible:rounded-monti-sm focus-visible:ring-2 focus-visible:ring-monti-contrast/20 [&_svg]:size-3 [&_svg]:shrink-0",
									sortable && "hover:text-monti-default",
									column.sort && "text-monti-default",
									held && "cursor-grabbing",
								)}
								onClick={() => {
									// The press that ended a drag is not a click.
									if (!dragged.current && sortable) onSort(column.id);
								}}
								onKeyDown={(event) => {
									if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
									event.preventDefault();
									onStep(column.id, event.key === "ArrowLeft" ? -1 : 1);
								}}
							>
								<span className="truncate">{column.label}</span>
								{column.sort === "desc" && <ArrowDown aria-hidden />}
								{column.sort === "asc" && <ArrowUp aria-hidden />}
							</button>
						</TableHead>
					);
				})}
				<TableHead size={end} aria-hidden />
			</tr>
		</TableHeader>
	);
}

export { ListHead };
export type { ListHeadColumn };
