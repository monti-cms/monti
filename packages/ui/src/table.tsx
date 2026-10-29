"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type * as React from "react";
import { Checkbox } from "./checkbox";
import { cn } from "./cn";

function Table({
	className,
	container = "scroll",
	layout = "auto",
	stickyHeader = false,
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
	/** The header row stays at the top while the rows scroll under it. */
	stickyHeader?: boolean;
}) {
	return (
		<div data-slot="table-container" className={cn("relative w-full", container === "scroll" && "overflow-x-auto")}>
			<table
				data-slot="table"
				className={cn(
					"w-full text-monti-body",
					layout === "fixed" && "table-fixed",
					stickyHeader && "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-monti-page",
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
	return (
		<tr
			data-slot="table-row"
			data-selected={selected || undefined}
			data-proposal={(selected && proposal) || undefined}
			aria-selected={selected || undefined}
			className={cn(
				props.onClick && "cursor-pointer not-data-selected:hover:bg-monti-muted",
				"group/row relative border-monti-muted border-b has-data-[slot=row-link]:cursor-pointer not-data-selected:has-[[data-slot=row-actions]_[aria-expanded=true]]:bg-monti-muted has-data-[slot=row-link]:not-data-selected:hover:bg-monti-muted data-selected:data-proposal:bg-monti-proposal-muted data-selected:border-monti-default data-selected:bg-monti-selected not-data-selected:data-popup-open:bg-monti-muted [&:has([data-slot=row-link])>td]:static",
				twoLine && "[&>td]:py-monti-16",
				className,
			)}
			{...props}
		/>
	);
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
	onCheckedChange: (checked: boolean) => void;
	/** The name of the check, for screen readers ("Select First post"). */
	label: string;
	/** The assistant picked this row. */
	proposal?: boolean;
}) {
	return (
		<span data-slot="row-check" className={cn("absolute top-1/2 -left-[26px] z-1 flex -translate-y-1/2", ON_ROW)}>
			<Checkbox
				checked={checked}
				onCheckedChange={(next) => onCheckedChange(next === true)}
				aria-label={label}
				proposal={proposal}
				className="bg-monti-page"
			/>
		</span>
	);
}

/**
 * The box a list's rows scroll in. It reaches 32px into the page's left margin, where the row checks ({@link RowCheck}) and the toolbar's select-all hang,
 * so scrolling does not cut them off; the rows keep the column's width. Put the table in it (`container="none"`); what holds it and the toolbar above must
 * not clip either.
 */
function ListScroll({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="list-scroll"
			className={cn("-ml-monti-32 flex min-h-0 flex-1 flex-col overflow-y-auto pl-monti-32", className)}
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
 * The ⋯ of a row: always shown, so the end of a row never looks empty. It stays above the row's link and keeps its own click. It takes one line of
 * the row (20px) and lets its button stand out above and below, so the ⋯ does not make the row taller than its text.
 */
function RowActions({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span data-slot="row-actions" className={cn("relative z-1 inline-flex h-5 items-center", className)} {...props} />
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
					"cursor-pointer border-0 bg-transparent p-0 text-left text-monti-default no-underline outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-monti-contrast/20 focus-visible:after:ring-inset",
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
 * The title cell of a row: the title in ink over its address in mono, both on one line each. The other columns are gray, so the ink alone makes
 * the title the emphasis.
 */
function RowTitle({
	title,
	address,
	className,
	...props
}: Omit<React.ComponentProps<"span">, "title"> & {
	title: React.ReactNode;
	/** Under the title: `/first-post`, a folder path. */
	address?: React.ReactNode;
}) {
	return (
		<span data-slot="row-title" className={cn("flex min-w-0 flex-col gap-monti-4", className)} {...props}>
			<span className="truncate text-monti-body text-monti-default">{title}</span>
			{address && <span className="truncate font-mono text-monti-faint text-monti-meta">{address}</span>}
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
			className={cn(
				"h-10 whitespace-nowrap px-monti-10 align-middle font-normal text-monti-caption text-monti-subtle first:pl-monti-12 last:pr-monti-12 [&:has([role=checkbox])]:pr-0",
				ALIGN[align],
				truncate && "max-w-0 truncate",
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
	...props
}: Omit<React.ComponentProps<"td">, "align"> & CellOptions) {
	return (
		<td
			data-slot="table-cell"
			className={cn(
				"relative whitespace-nowrap px-monti-10 py-monti-10 align-middle first:pl-monti-12 last:pr-monti-12 [&:has([role=checkbox])]:pr-0",
				ALIGN[align],
				truncate && "max-w-0 truncate",
				width && COLUMN_WIDTH[width],
				valign === "top" && "align-top",
				wrap && "whitespace-normal break-words",
				tone === "muted" && "text-monti-muted",
				tone === "subtle" && "text-monti-note text-monti-subtle",
				filler && "p-0",
				className,
			)}
			style={size === undefined ? style : { ...style, width: size }}
			{...props}
		/>
	);
}

export {
	ListScroll,
	RowActions,
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
