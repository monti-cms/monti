"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { Checkbox } from "./checkbox";
import { cn } from "./cn";
import { IconButton } from "./icon-button";
import { Folder, OverflowMenuHorizontal } from "./icons";

function Table({
	className,
	container = "scroll",
	layout = "auto",
	stickyHeader,
	width,
	columns,
	style,
	children,
	...props
}: React.ComponentProps<"table"> & {
	/**
	 * The width in px of each column, in order (`undefined` for one that takes the room the others leave). A fixed-layout table then takes its widths from
	 * here and not from its first row, so a row that is one cell across (the bulk bar) leaves the columns where they are.
	 */
	columns?: readonly (number | undefined)[];
	/** A total width in px that the screen computes (the sum of resized columns); without it the table fills its box. */
	width?: number;
	/**
	 * `scroll`: the table scrolls sideways in its own box. `none`: the page or a parent scrolls it (needed for a sticky header under an outer scroll,
	 * and for the row check that hangs in the left margin, which a scrolling box would cut off).
	 */
	container?: "scroll" | "none";
	/** `fixed`: columns keep the widths set on their heads, whatever the content (a list with resizable columns). */
	layout?: "auto" | "fixed";
	/** The header row stays at the top while the rows scroll under it. On by default for a table the page scrolls (`container="none"`). */
	stickyHeader?: boolean;
}) {
	return (
		<div data-slot="table-container" className={cn("relative w-full", container === "scroll" && "overflow-x-auto")}>
			<table
				data-slot="table"
				className={cn(
					"w-full text-monti-body",
					layout === "fixed" && "table-fixed",
					// With no widths set, the columns take their content's width and a column that ends in "…" (the title) takes what is left.
					layout === "auto" && !columns && "[&_[data-truncate]]:w-full",
					// The row's rule does not stay with stuck cells: each cell draws it at its own foot, so the rows pass under a line.
					(stickyHeader ?? container === "none") &&
						"[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-monti-page [&_thead_th]:shadow-[inset_0_-1px_0_var(--monti-border-muted)] [&_thead_tr]:border-b-transparent",
					className,
				)}
				style={width === undefined ? style : { ...style, width }}
				{...props}
			>
				{columns && (
					<colgroup>
						{columns.map((size, index) => (
							// The columns are a fixed run of the same table, never reordered.
							<col key={index} style={size === undefined ? undefined : { width: size }} />
						))}
					</colgroup>
				)}
				{children}
			</table>
		</div>
	);
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
	return (
		<thead data-slot="table-header" className={cn("[&_tr]:border-monti-muted [&_tr]:border-b", className)} {...props} />
	);
}

function TableBody({
	className,
	dimmed = false,
	...props
}: React.ComponentProps<"tbody"> & {
	/** The rows are out of date while new ones load: shown, but quieter. */
	dimmed?: boolean;
}) {
	return (
		<tbody data-slot="table-body" className={cn("transition-opacity", dimmed && "opacity-60", className)} {...props} />
	);
}

/**
 * A row of a list. Each row has its rule underneath. A picked row is filled with the selected background inside the table's rectangle (no rounded
 * corners, nothing outside it) and its rule goes darker, so a run of picked rows still reads as separate rows; `proposal` makes the fill the
 * proposal tint, for rows the assistant picked. The check appears when the pointer is on the row ({@link RowCheck}); the ⋯ is always there ({@link RowActions}).
 *
 * A row that can be opened (it has an `onClick` or a {@link RowLink}) takes the muted background under the pointer, one step lighter than a picked row; a
 * row of a table that opens nothing takes none. Whatever the row, it keeps that background while its own menu is open (a right click, or its ⋯), so it is
 * plain which row the menu belongs to. A picked row stays as it is.
 */
function TableRow({
	className,
	selected,
	proposal = false,
	twoLine = false,
	...props
}: React.ComponentProps<"tr"> & {
	/** A row the writer picked (checked for a bulk action, or open in a side panel). */
	selected?: boolean;
	/** The assistant picked this row and nobody has touched it yet. */
	proposal?: boolean;
	/** The row has a second line under its title (a template's sections): 16px above and below instead of 10. */
	twoLine?: boolean;
}) {
	const { onClick, onAuxClick } = props;
	return (
		<tr
			data-slot="table-row"
			data-selected={selected || undefined}
			data-proposal={(selected && proposal) || undefined}
			aria-selected={selected || undefined}
			className={cn(
				props.onClick && "cursor-pointer not-data-selected:hover:bg-monti-muted",
				"group/row relative border-monti-muted border-b has-data-[slot=row-link]:cursor-pointer not-data-selected:has-[[data-slot=row-actions]_[aria-expanded=true]]:bg-monti-muted not-data-selected:has-[[data-slot=row-link]:focus-visible]:bg-monti-muted has-data-[slot=row-link]:not-data-selected:hover:bg-monti-muted aria-disabled:pointer-events-none aria-disabled:opacity-45 data-selected:data-proposal:bg-monti-proposal-muted data-selected:border-monti-default data-selected:bg-monti-selected not-data-selected:data-popup-open:bg-monti-muted [&:has([data-slot=row-link])>td]:static",
				twoLine && "[&>td]:py-monti-16",
				className,
			)}
			{...props}
			onClick={(event) => {
				// The press this row passes on to its link comes back up through the row: it is the same press, not a second one.
				if (passingOn) return;
				onClick?.(event);
				if (!event.defaultPrevented) openFromOver(event);
			}}
			onAuxClick={(event) => {
				onAuxClick?.(event);
				if (!event.defaultPrevented) openFromOver(event);
			}}
		/>
	);
}

/** What keeps its own press on a row: the controls, and what holds them. */
const OWN_PRESS =
	"a, button, input, select, textarea, label, summary, [role=button], [role=link], [role=checkbox], [role=switch], [role=tab], [role=menuitem], [role=combobox], [contenteditable=true], [data-slot=row-check], [data-slot=row-actions]";

let passingOn = false;

/**
 * A row's link covers the row, and some of the row stands over the link so the pointer can find it: a cell's words that say themselves whole when pointed at, a
 * tooltip's trigger. A press there still opens the row, as a press on the link would: a click is passed on with the keys held (a new tab), and the middle
 * button opens the link's address in a new tab.
 */
function openFromOver(event: React.MouseEvent<HTMLTableRowElement>) {
	const row = event.currentTarget;
	const link = row.querySelector<HTMLElement>("[data-slot=row-link]");
	const pressed = event.target;
	// A press in a menu the row opened reaches the row through React, not through the page: it is not a press on the row.
	if (!link || !(pressed instanceof Element) || !row.contains(pressed)) return;
	if (link.contains(pressed) || pressed.closest(OWN_PRESS)) return;
	if (event.type === "auxclick") {
		if (event.button === 1 && link instanceof HTMLAnchorElement && link.href)
			window.open(link.href, "_blank", "noopener");
		return;
	}
	const { metaKey, ctrlKey, shiftKey, altKey } = event;
	passingOn = true;
	try {
		link.dispatchEvent(
			new MouseEvent("click", { bubbles: true, cancelable: true, metaKey, ctrlKey, shiftKey, altKey }),
		);
	} finally {
		passingOn = false;
	}
}

/**
 * What shows only while the pointer or the keyboard is on the row, or the row is picked, or its menu is open: the check in the left margin. On a
 * touch screen it is always shown.
 */
const ON_ROW =
	"opacity-0 group-hover/row:opacity-100 group-data-selected/row:opacity-100 focus-within:opacity-100 has-aria-expanded:opacity-100 pointer-coarse:opacity-100";

/**
 * The check of a row. It hangs 26px outside the table's left edge, on the same vertical line as the select-all of the {@link PageToolbar}, so the
 * first letters of the rows stay in one column. Put it in the row's first cell; the table must not scroll itself (`container="none"`).
 */
function RowCheck({
	checked,
	onCheckedChange,
	label,
	proposal = false,
}: {
	checked: boolean;
	/** Without it the check is drawn and does nothing (a screen spec's look, before its behavior is wired). */
	onCheckedChange?: (checked: boolean) => void;
	/** The name of the check, for screen readers ("Select First post"). */
	label: string;
	/** The assistant picked this row. */
	proposal?: boolean;
}) {
	return (
		<span data-slot="row-check" className={cn("absolute top-1/2 -left-[26px] z-1 flex -translate-y-1/2", ON_ROW)}>
			<Checkbox
				checked={checked}
				onCheckedChange={(next) => onCheckedChange?.(next === true)}
				aria-label={label}
				proposal={proposal}
				className="bg-monti-page"
			/>
		</span>
	);
}

/**
 * The box a list's rows sit in. It reaches 32px into the page's left margin, where the row checks ({@link RowCheck}) and the toolbar's select-all hang,
 * so nothing cuts them off; the rows keep the column's width. It does not scroll: the page does, and the table's column heads stay at its top
 * (`Table stickyHeader`). Put the table in it (`container="none"`); what holds it and the toolbar above must not clip either.
 */
function ListScroll({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="list-scroll"
			className={cn("-ml-monti-32 flex flex-1 flex-col pl-monti-32", className)}
			{...props}
		/>
	);
}

/** The 40px thumb column of a media row: a file's picture (`Image size="row"`), or the icon of a folder row centered where the pictures are. */
function RowThumb({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="row-thumb"
			className={cn("flex w-monti-40 shrink-0 justify-center text-monti-subtle", className)}
			{...props}
		/>
	);
}

/**
 * A row's ⋯: always shown, so the end of a row never looks empty: a small round icon button (`IconButton size="xs"`, 24px), which stands in the row
 * without making it taller. It stays above the row's link and keeps its own click. `label` is the screen reader name and the tooltip. To make it the trigger
 * of a menu, wrap it with `trigger`: `trigger={(button) => <DropdownMenuTrigger render={button} />}`.
 */
function RowMore({
	label,
	trigger,
	...props
}: Omit<React.ComponentProps<typeof IconButton>, "children" | "size" | "pressed" | "variant">) {
	return (
		<IconButton data-slot="row-more" size="xs" label={label} trigger={trigger} {...props}>
			<OverflowMenuHorizontal aria-hidden />
		</IconButton>
	);
}

/**
 * Where a row's ⋯ (and its other end buttons) stand: above the row's link, one line of the row tall (`h-lh`, 20px), so the 24px button stands out 2px above
 * and below and the row is never taller than its text.
 */
function RowActions({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span data-slot="row-actions" className={cn("relative z-1 inline-flex h-lh items-center", className)} {...props} />
	);
}

/**
 * The title of a row as the way into it, in ink: a link (the app's router link goes in `render`), or a button in `render`. What it opens covers the whole
 * row, so a click anywhere on the row opens it; the row's check and its ⋯ stay above and keep their own clicks. Dragging the row drags the row, not the
 * link.
 */
function RowLink({ className, render, ...props }: useRender.ComponentProps<"a"> & React.ComponentProps<"a">) {
	return useRender({
		defaultTagName: "a",
		props: mergeProps<"a">(
			{
				draggable: false,
				className: cn(
					"cursor-pointer border-0 bg-transparent p-0 text-left text-monti-default no-underline outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-monti-contrast/50 focus-visible:after:ring-inset",
					className,
				),
			},
			props,
		),
		render,
		state: { slot: "row-link" },
	});
}

/**
 * The title cell of a row, on one line: the title in ink, then its address in mono, faint (`/first-post`; a folder's count, "글 2"). The other columns (cms-allow-korean)
 * are gray, so the ink alone makes the title the emphasis. Short of room, the address gives way first. A folder row has its folder icon before the title; a media row its
 * {@link RowThumb}, in the same column as the title so a head's name stands over both.
 */
function RowTitle({
	title,
	address,
	addressTitle,
	folder = false,
	thumb,
	editing = false,
	className,
	...props
}: Omit<React.ComponentProps<"span">, "title"> & {
	title: React.ReactNode;
	/** After the title: `/first-post`, or what a folder holds ("글 2"). (cms-allow-korean: quotes the words) */
	address?: React.ReactNode;
	/** The address in words, when `address` is more than a string: what it says when it is cut and pointed at. */
	addressTitle?: string;
	/** The row is a folder: its icon leads the line. */
	folder?: boolean;
	/** A {@link RowThumb} leading the line. */
	thumb?: React.ReactNode;
	/** The title is a `RenameField` being typed in: it is not cut to the line, so the field's underline shows. */
	editing?: boolean;
}) {
	return (
		<span
			data-slot="row-title"
			className={cn("flex min-w-0 gap-monti-12", thumb ? "items-center" : "items-baseline", className)}
			{...props}
		>
			{/* Beside a picture the words stand at its middle, as the row's other cells do. */}
			<span className={cn("flex min-w-0 gap-monti-8", thumb ? "items-center" : "items-baseline")}>
				{folder && <Folder aria-hidden size={16} className="shrink-0 self-center text-monti-subtle" />}
				{thumb && <span className="mr-monti-4 flex shrink-0 self-center">{thumb}</span>}
				<span className={cn("min-w-0 text-monti-body text-monti-default", !editing && "truncate")}>{title}</span>
			</span>
			{address && (
				// It is cut before the title is, so it says itself whole when pointed at: it stands over the row's link for the pointer to find it.
				<span
					title={addressTitle ?? (typeof address === "string" ? address : undefined)}
					className="relative z-1 min-w-0 shrink-[999] truncate font-mono text-monti-faint text-monti-meta"
				>
					{address}
				</span>
			)}
		</span>
	);
}

/**
 * Where a column's content sits, whether long content ends in "…" instead of widening the column, a fixed column width, top alignment for
 * rows of uneven height, and a muted tone for secondary columns.
 */
export interface CellOptions {
	align?: "start" | "center" | "end";
	truncate?: boolean;
	width?: keyof typeof COLUMN_WIDTH;
	/** A column width in px that the screen computes (a column the writer resized); takes over from `width`. */
	size?: number;
	valign?: "top";
	/** Long content wraps onto more lines instead of widening the column. */
	wrap?: boolean;
	/** `muted` for a secondary column, `subtle` for the quietest (a category, a note), at the note size. */
	tone?: "muted" | "subtle";
	/** An empty column that takes the width the others leave (before a trailing actions column in a fixed-layout table). */
	filler?: boolean;
}
const COLUMN_WIDTH = { xs: "w-14", sm: "w-24", md: "w-28", lg: "w-40" } as const;
const ALIGN = { start: "text-left", center: "text-center", end: "text-right tabular-nums" } as const;

function TableHead({
	className,
	align = "start",
	truncate,
	width,
	size,
	valign,
	tone,
	filler,
	style,
	...props
}: Omit<React.ComponentProps<"th">, "align"> & CellOptions) {
	return (
		<th
			data-slot="table-head"
			data-truncate={truncate || undefined}
			className={cn(
				"h-10 whitespace-nowrap px-monti-10 align-middle font-normal text-monti-caption text-monti-subtle first:pl-monti-12 last:pr-monti-12 [&:has([role=checkbox])]:pr-0",
				ALIGN[align],
				truncate && "max-w-0 truncate has-[[data-slot=row-check]]:overflow-visible",
				width && COLUMN_WIDTH[width],
				valign === "top" && "align-top",
				tone === "muted" && "text-monti-muted",
				filler && "p-0",
				className,
			)}
			style={size === undefined ? style : { ...style, width: size }}
			{...props}
		/>
	);
}

function TableCell({
	className,
	align = "start",
	truncate,
	width,
	size,
	valign,
	wrap,
	tone,
	filler,
	style,
	title,
	children,
	...props
}: Omit<React.ComponentProps<"td">, "align"> & CellOptions) {
	return (
		<td
			data-slot="table-cell"
			data-truncate={truncate || undefined}
			title={title}
			className={cn(
				// Its pieces sit on the middle of the line, not on their letters' baselines: pieces of two sizes on one baseline (a chip, a title) would
				// make the line taller than either, and the row 2px taller than the design system's 42.
				"relative whitespace-nowrap px-monti-10 py-monti-10 align-middle *:align-middle first:pl-monti-12 last:pr-monti-12 [&:has([role=checkbox])]:pr-0",
				ALIGN[align],
				// The row's check hangs in the left margin, so its cell does not clip. In a row with a link the cells are static and the check stands on the row
				// itself: there the cell clips as any other, and a first column dragged narrow keeps its words in.
				// A piece of it that can shrink (a status, its mark kept) shrinks to the cell.
				truncate &&
					"max-w-0 truncate *:max-w-full has-[[data-slot=row-check]]:overflow-visible group-has-data-[slot=row-link]/row:has-[[data-slot=row-check]]:overflow-hidden",
				// With a `title` it says its value whole when pointed at. A row's link covers the row, so the cell's pieces stand over the link for the
				// pointer to find them; a press on them still opens the row (`TableRow`).
				title !== undefined && "[&>:not([data-slot=row-check])]:relative [&>:not([data-slot=row-check])]:z-1",
				width && COLUMN_WIDTH[width],
				valign === "top" && "align-top *:align-top",
				wrap && "whitespace-normal break-words",
				tone === "muted" && "text-monti-muted",
				tone === "subtle" && "text-monti-note text-monti-subtle",
				filler && "p-0",
				className,
			)}
			style={size === undefined ? style : { ...style, width: size }}
			{...props}
		>
			{title === undefined
				? children
				: // Bare words cannot stand over anything: they get a box of their own.
					React.Children.map(children, (child) =>
						// The box keeps the words where bare words stand, on the line's baseline: the row stays as tall as one without a `title`.
						typeof child === "string" || typeof child === "number" ? (
							<span className="align-baseline!">{child}</span>
						) : (
							child
						),
					)}
		</td>
	);
}

export {
	ListScroll,
	RowActions,
	RowMore,
	RowCheck,
	RowThumb,
	RowLink,
	RowTitle,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
};
