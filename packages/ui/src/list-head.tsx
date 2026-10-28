"use client";

import { Add, ArrowDown, ArrowUp } from "@carbon/icons-react";
import * as React from "react";
import { Checkbox } from "./checkbox";
import { cn } from "./cn";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";
import type { SelectAll } from "./page-header";
import { TableHead, TableHeader } from "./table";

/** One column of a list as its head names it. */
type ListHeadColumn = {
	id: string;
	label: string;
	/** Width in px; without it the column takes the room the others leave (the title). */
	size?: number;
	align?: "start" | "end";
	/** Set on the column the list is sorted by: its name is in ink with ↓ or ↑. */
	sort?: "asc" | "desc";
	/** A filter is on in this column: a dot follows its name. */
	filtered?: boolean;
	/** What the menu under the name holds: the rows of a menu (sort, values to filter by, hide). Without it the name is plain. */
	menu?: React.ReactNode;
};

/** The columns that are off, offered by the + at the end of the head row. */
type ListHeadAdd = {
	/** The name of the + button ("Add column"). */
	label: string;
	columns: readonly { id: string; label: string }[];
	onAdd: (id: string) => void;
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

/** The menu card under a name: 220px, its rows' letters start on the name's line (the card reaches 15px past the name's side). */
const MENU_WIDTH = 220;
const MENU_REACH = 15;

/**
 * The head row of a list: the name of each column, and at the end a + over the rows' ⋯. A name is a button: pressing it (without dragging) opens the
 * column's `menu` under the name; a name with no `menu` is plain. The column the list is sorted by shows its name in ink with ↓ or ↑, the column whose menu
 * is open is in ink too, and a filtered column has a dot after its name. The + lists `add.columns` (the columns that are off) and calls `add.onAdd`.
 *
 * Any name can be dragged sideways: it lifts and follows the pointer while the other columns make room, and letting go calls `onPlace(from, to)` with
 * the column whose place it took. `onPreview` gets the order shown while dragging (`null` after), so the rows follow it. Alt with ← or → on a focused
 * name calls `onStep(id, -1 | 1)`.
 *
 * `selectAll` hangs a check in the left margin, on the line of the rows' checks: hidden until the pointer is on the head row, and it picks the page.
 */
function ListHead({
	columns,
	end,
	add,
	selectAll,
	moveLabel,
	onPlace,
	onStep,
	onPreview,
	onMenuOpenChange,
}: {
	/** The columns shown, in order. */
	columns: readonly ListHeadColumn[];
	/** The width of the cell at the end, over the rows' ⋯. */
	end?: number;
	/** The + at the end. Without it, or with no columns left to add, there is none. */
	add?: ListHeadAdd;
	/** The select-all of the page. Leave it out while rows are picked: the bulk bar holds it then. */
	selectAll?: SelectAll;
	/** What each name's description says about moving it ("Alt+← → moves the column"). */
	moveLabel: string;
	onPlace: (from: string, to: string) => void;
	onStep: (id: string, direction: -1 | 1) => void;
	onPreview?: (order: string[] | null) => void;
	/** Called with `true` when a column's menu opens and `false` when it closes, so what sits above the head can hold still while it is open. */
	onMenuOpenChange?: (open: boolean) => void;
}) {
	const row = React.useRef<HTMLTableRowElement>(null);
	// The press in progress: where it started, where on the name it took hold, and the order when it started.
	const press = React.useRef<{ id: string; x: number; grab: number; ids: string[] } | null>(null);
	const [drag, setDrag] = React.useState<{ id: string; offset: number } | null>(null);
	// The column whose menu is open, and whether its card is lined up with the name's right side (a name near the end of the row).
	const [open, setOpen] = React.useState<{ id: string; flip: boolean } | null>(null);
	const dragged = React.useRef(false);
	const menuOpen = open !== null;
	React.useEffect(() => onMenuOpenChange?.(menuOpen), [menuOpen]);
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

	/** Opens the menu of `column` under its name, lined up with the name's right side when the card would reach past the end of the row. */
	const openFor = (column: ListHeadColumn, name: Element | null | undefined) => {
		const left = name?.getBoundingClientRect().left ?? 0;
		const rowEnd = row.current?.getBoundingClientRect().right ?? 0;
		setOpen({ id: column.id, flip: column.align === "end" || left - MENU_REACH + MENU_WIDTH > rowEnd });
	};

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
				className="group/head relative"
				onPointerMove={(event) => {
					const held = press.current;
					if (!held) return;
					pointerX.current = event.clientX;
					if (!drag) {
						if (Math.abs(event.clientX - held.x) < DRAG_START) return;
						event.currentTarget.setPointerCapture?.(event.pointerId);
						dragged.current = true;
						setOpen(null);
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
				{columns.map((column, index) => {
					const held = drag?.id === column.id;
					const isOpen = open?.id === column.id;
					const name = (
						<>
							<span className="truncate">{column.label}</span>
							{column.filtered && (
								<span
									aria-hidden
									data-slot="column-dot"
									className="size-[5px] shrink-0 rounded-monti-full bg-monti-emphasis"
								/>
							)}
							{column.sort === "desc" && <ArrowDown aria-hidden />}
							{column.sort === "asc" && <ArrowUp aria-hidden />}
						</>
					);
					const buttonClass = cn(
						"inline-flex max-w-full cursor-grab items-center gap-monti-4 border-0 bg-transparent p-0 font-normal text-inherit outline-none focus-visible:rounded-monti-sm focus-visible:ring-2 focus-visible:ring-monti-contrast/20 [&_svg]:size-3 [&_svg]:shrink-0",
						column.menu && "hover:text-monti-default",
						(column.sort || isOpen) && "text-monti-default",
						held && "cursor-grabbing",
					);
					const onKeyDown = (event: React.KeyboardEvent) => {
						if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
						event.preventDefault();
						onStep(column.id, event.key === "ArrowLeft" ? -1 : 1);
					};
					return (
						<TableHead
							key={column.id}
							data-column={column.id}
							data-held={held ? "" : undefined}
							size={column.size}
							align={column.align}
							aria-sort={column.sort === "asc" ? "ascending" : column.sort === "desc" ? "descending" : undefined}
							// The select-all inside the first name would be read as part of it.
							aria-label={index === 0 && selectAll ? column.label : undefined}
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
							{index === 0 && selectAll && !drag && (
								<span
									data-slot="select-all"
									className="absolute top-1/2 -left-[26px] z-1 flex -translate-y-1/2 opacity-0 pointer-coarse:opacity-100 focus-within:opacity-100 group-hover/head:opacity-100"
								>
									<Checkbox
										checked={selectAll.state === "all"}
										indeterminate={selectAll.state === "some"}
										onCheckedChange={(next) => selectAll.onChange(next === true)}
										aria-label={selectAll.label}
										className="bg-monti-page"
									/>
								</span>
							)}
							{column.menu ? (
								<DropdownMenu
									open={isOpen}
									// Closing (Escape, a press outside, a pick) comes from the menu; so does opening with ↓ from the keyboard.
									onOpenChange={(next) =>
										next
											? openFor(column, cellOf(column.id)?.querySelector("button"))
											: setOpen((current) => (current?.id === column.id ? null : current))
									}
								>
									<DropdownMenuTrigger
										aria-description={moveLabel}
										className={buttonClass}
										// A press that may become a drag opens nothing; the click that follows a press that did not move opens the menu.
										onMouseDown={(event) => event.preventBaseUIHandler()}
										onClick={(event) => {
											event.preventBaseUIHandler();
											if (dragged.current) return;
											if (isOpen) return setOpen(null);
											openFor(column, event.currentTarget);
										}}
										onKeyDown={onKeyDown}
									>
										{name}
									</DropdownMenuTrigger>
									<DropdownMenuContent
										align={open?.flip ? "end" : "start"}
										alignOffset={-MENU_REACH}
										sideOffset={12}
										className="w-[220px] min-w-0"
									>
										{column.menu}
									</DropdownMenuContent>
								</DropdownMenu>
							) : (
								<button type="button" aria-description={moveLabel} className={buttonClass} onKeyDown={onKeyDown}>
									{name}
								</button>
							)}
						</TableHead>
					);
				})}
				<TableHead size={end} aria-hidden={add === undefined || add.columns.length === 0 || undefined}>
					{add && add.columns.length > 0 && (
						<DropdownMenu>
							<DropdownMenuTrigger
								aria-label={add.label}
								className="mr-monti-4 ml-auto flex size-6 cursor-pointer items-center justify-center rounded-monti-full border-0 bg-transparent p-0 text-monti-subtle outline-none hover:bg-monti-selected hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/20 data-popup-open:bg-monti-selected data-popup-open:text-monti-default [&_svg]:size-3.5"
							>
								<Add aria-hidden />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" sideOffset={4} className="w-[220px] min-w-0">
								{add.columns.map((column) => (
									<DropdownMenuItem key={column.id} onClick={() => add.onAdd(column.id)}>
										{column.label}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</TableHead>
			</tr>
		</TableHeader>
	);
}

export { ListHead };
export type { ListHeadAdd, ListHeadColumn };
