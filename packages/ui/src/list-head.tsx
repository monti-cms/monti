"use client";

import * as React from "react";
import { Checkbox } from "./checkbox";
import { cn } from "./cn";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";
import { Add, ArrowDown, ArrowUp } from "./icons";
import type { SelectAll } from "./page-header";
import { ResizeHandle } from "./resize-handle";
import { TableHead, TableHeader } from "./table";

/** One column of a list as its head names it. */
type ListHeadColumn = {
	id: string;
	label: string;
	/** Width in px; without it the column takes the room the others leave (the title, until it is resized). */
	size?: number;
	/**
	 * The width its kind starts at (`LIST_COLUMN_SIZE`): the narrowest it can be dragged, and where a double-click on its handle takes it back. A column
	 * without it is the title: it takes the room left until it is dragged, is never under `TITLE_MIN`, and a double-click lets it take the room left again.
	 */
	kindSize?: number;
	align?: "start" | "end";
	/** Set on the column the list is sorted by: its name is in ink with ↓ or ↑. */
	sort?: "asc" | "desc";
	/** A filter is on in this column: a dot follows its name. */
	filtered?: boolean;
	/** What the menu under the name holds: the rows of a menu (sort, values to filter by, hide). Without it the name is plain. */
	menu?: React.ReactNode;
};

/**
 * The width a list's column starts at by what it shows, in px (doc 06: the kind's width is where a column starts; the admin can drag it wider). The title
 * has none: it takes the room the others leave. `one` is a single value (a category, a select), `many` several (tags) or a line of text (a summary). `end`
 * is the cell over the rows' ⋯.
 */
const LIST_COLUMN_SIZE = { status: 76, one: 84, many: 152, locale: 60, date: 84, end: 38 } as const;
type ListColumnSize = keyof typeof LIST_COLUMN_SIZE;
/** The widest a column can be dragged; the title goes to `TITLE_MAX` (core's `list.savePrefs` keeps no more). */
const LIST_COLUMN_MAX = 480;
/** The narrowest and widest the title can be dragged. */
const TITLE_MIN = 200;
const TITLE_MAX = 960;

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

/**
 * The column the held one has passed, or `undefined`: the farthest neighbour whose middle the held name's middle has reached, going the way it is dragged.
 * The middles, not the pointer over a cell: after a narrow column trades places with a wide one, the pointer can lie over the wide one again, and a test of
 * the pointer would trade them back on the next move, and back again (the flicker). A middle the held name has reached stays behind it after the trade.
 */
function crossedColumn(
	order: readonly string[],
	id: string,
	heldLeft: number,
	cellOf: (id: string) => HTMLElement | undefined,
): string | undefined {
	const width = cellOf(id)?.getBoundingClientRect().width ?? 0;
	const middle = heldLeft + width / 2;
	const middleOf = (other: string) => {
		const box = cellOf(other)?.getBoundingClientRect();
		return box === undefined ? undefined : box.left + box.width / 2;
	};
	const index = order.indexOf(id);
	let crossed: string | undefined;
	for (let at = index - 1; at >= 0; at--) {
		const other = order[at] as string;
		const otherMiddle = middleOf(other);
		if (otherMiddle === undefined || middle > otherMiddle) break;
		crossed = other;
	}
	if (crossed !== undefined) return crossed;
	for (let at = index + 1; at < order.length; at++) {
		const other = order[at] as string;
		const otherMiddle = middleOf(other);
		if (otherMiddle === undefined || middle < otherMiddle) break;
		crossed = other;
	}
	return crossed;
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
 *
 * With `onResize`, every column, the title too, gets a `ResizeHandle` on its right edge (the end cell has none). The edge follows the pointer: the
 * columns after it move along, and the room left over stays empty at the end of the row (a filler cell before the end cell; give the rows one too, and the
 * table's `columns` an `undefined` there). A row wider than its box makes the page scroll sideways. While the title still takes the room left, the first
 * drag of any edge pins the title at the width it has, so the other edges stay where they are. `onResize(changes, commit)` gets the widths that change
 * (`null`: back to the kind's width, or for the title back to taking the room left); `commit` is false while the pointer is down. The arrow keys step a
 * handle as on a side panel; a double-click resets the column. A press on a handle never starts moving the column.
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
	onResize,
	resizeLabel,
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
	moveLabel?: string;
	/** Moves a column onto the place of another. Without it (and `onStep`) the names do not move: a list whose columns are fixed. */
	onPlace?: (from: string, to: string) => void;
	onStep?: (id: string, direction: -1 | 1) => void;
	onPreview?: (order: string[] | null) => void;
	/** Sets the widths that change (`null`: back to the kind's width); `commit` is false while a drag is under way. Without it no column has a handle. */
	onResize?: (changes: Record<string, number | null>, commit: boolean) => void;
	/** Each handle's screen reader name, from the column's name ("Resize Tags"). */
	resizeLabel?: (label: string) => string;
}) {
	const row = React.useRef<HTMLTableRowElement>(null);
	// The press in progress: where it started, where on the name it took hold, and the order when it started.
	const press = React.useRef<{ id: string; x: number; grab: number; ids: string[] } | null>(null);
	const [drag, setDrag] = React.useState<{ id: string; offset: number } | null>(null);
	// The column whose menu is open, and whether its card is lined up with the name's right side (a name near the end of the row).
	const [open, setOpen] = React.useState<{ id: string; flip: boolean } | null>(null);
	// The column whose handle is being dragged: its line stays drawn while the pointer leaves the handle.
	const [resizing, setResizing] = React.useState<string | null>(null);
	const dragged = React.useRef(false);
	const pointerX = React.useRef(0);
	const ids = columns.map((column) => column.id);
	const cellOf = (id: string) =>
		[...(row.current?.querySelectorAll<HTMLElement>("[data-column]") ?? [])].find((cell) => cell.dataset.column === id);
	// The column that takes the room left (the title before it is dragged), and its width as laid out, for its handle and to pin it on a first drag.
	const fluid = columns.find((column) => column.size === undefined);
	const [fluidWidth, setFluidWidth] = React.useState(0);
	React.useLayoutEffect(() => {
		const cell = fluid ? cellOf(fluid.id) : undefined;
		if (!cell) return;
		const observer = new ResizeObserver(() => setFluidWidth(Math.round(cell.getBoundingClientRect().width)));
		observer.observe(cell);
		return () => observer.disconnect();
	}, [fluid?.id]);
	const limits = (column: ListHeadColumn) =>
		column.kindSize === undefined ? { min: TITLE_MIN, max: TITLE_MAX } : { min: column.kindSize, max: LIST_COLUMN_MAX };
	const resize = (column: ListHeadColumn, width: number, commit: boolean) => {
		setResizing(commit ? null : column.id);
		const { min, max } = limits(column);
		const next = Math.min(max, Math.max(min, Math.round(width)));
		// A drag pins the column that takes the room left, so only the dragged edge moves.
		const pin = fluid && fluid.id !== column.id ? { [fluid.id]: fluidWidth } : {};
		onResize?.({ ...pin, [column.id]: next === column.kindSize && commit ? null : next }, commit);
	};

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
		// The press that opened the menu is over: the menu takes the pointer from here, and its release never reaches the head.
		press.current = null;
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
			if (to !== undefined && to !== held.id) onPlace?.(held.id, to);
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
					// The button is not down any more: the press ended where the head did not hear it (in an open menu, outside the window). A name is
					// only ever dragged while the button is held.
					if ((event.buttons & 1) === 0) {
						finish(false);
						return;
					}
					pointerX.current = event.clientX;
					if (!drag) {
						if (Math.abs(event.clientX - held.x) < DRAG_START) return;
						// The pointer may already be gone (a pen lifted, a synthetic move); the drag still follows the moves the row hears.
						try {
							event.currentTarget.setPointerCapture?.(event.pointerId);
						} catch {}
						dragged.current = true;
						setOpen(null);
						setDrag({ id: held.id, offset: lift(held.id, 0) });
						return;
					}
					const over = crossedColumn(ids, held.id, event.clientX - held.grab, cellOf);
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
						"inline-flex max-w-full items-center gap-monti-4 border-0 bg-transparent p-0 font-normal text-inherit outline-none focus-visible:rounded-monti-sm focus-visible:ring-2 focus-visible:ring-monti-contrast/50 [&_svg]:size-3 [&_svg]:shrink-0",
						column.menu && "hover:text-monti-default",
						(column.sort || isOpen) && "text-monti-default",
						onPlace && "cursor-grab",
						held && "cursor-grabbing",
					);
					const onKeyDown = (event: React.KeyboardEvent) => {
						if (!onStep || !event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
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
							className="relative touch-none select-none font-normal data-held:z-20 data-held:bg-monti-selected data-held:shadow-monti-floating"
							style={held ? { transform: `translateX(${drag.offset}px)` } : undefined}
							onPointerDown={(event) => {
								if (event.button !== 0 || !onPlace) return;
								// The handle's press resizes; it never moves the column.
								if ((event.target as Element).closest("[data-slot=resize-handle]")) return;
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
										aria-description={onPlace ? moveLabel : undefined}
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
								<button
									type="button"
									aria-description={onPlace ? moveLabel : undefined}
									className={buttonClass}
									onKeyDown={onKeyDown}
								>
									{name}
								</button>
							)}
							{onResize && !drag && (
								<ResizeHandle
									value={column.size ?? fluidWidth}
									{...limits(column)}
									onChange={(width, commit) => resize(column, width, commit)}
									onReset={() => {
										setResizing(null);
										onResize({ [column.id]: null }, true);
									}}
									label={resizeLabel?.(column.label)}
									resizing={resizing === column.id}
									// Inside the column's right edge, in its padding: a stuck head cell paints over anything that reaches into the next one.
									className="translate-x-0"
								/>
							)}
						</TableHead>
					);
				})}
				{onResize && !fluid && <TableHead filler aria-hidden />}
				<TableHead size={end} aria-hidden={add === undefined || add.columns.length === 0 || undefined}>
					{add && add.columns.length > 0 && (
						<DropdownMenu>
							<DropdownMenuTrigger
								aria-label={add.label}
								className="mr-monti-4 ml-auto flex size-monti-control-xs cursor-pointer items-center justify-center rounded-monti-full border-0 bg-transparent p-0 text-monti-subtle outline-none hover:bg-monti-selected hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/50 data-popup-open:bg-monti-selected data-popup-open:text-monti-default [&_svg]:size-3.5"
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

export { LIST_COLUMN_SIZE, ListHead };
export type { ListColumnSize, ListHeadAdd, ListHeadColumn };
