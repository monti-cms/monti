"use client";

import type * as React from "react";
import { cn } from "./cn";

function Table({
	className,
	container = "scroll",
	inset = "none",
	layout = "auto",
	stickyHeader = false,
	width,
	style,
	...props
}: React.ComponentProps<"table"> & {
	/** A total width in px that the screen computes (the sum of resized columns); without it the table fills its box. */
	width?: number;
	/** `scroll`: the table scrolls sideways in its own box. `none`: the page or a parent scrolls it (needed for a sticky header under an outer scroll). */
	container?: "scroll" | "none";
	/** `page`: the first and last column line up with the page's side padding (a table that is the page's main list). */
	inset?: "none" | "page";
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
					"w-full caption-bottom text-monti-body",
					layout === "fixed" && "table-fixed",
					stickyHeader && "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-monti-page",
					inset === "page" &&
						"[&_td:first-child]:pl-wide [&_td:last-child]:pr-wide [&_th:first-child]:pl-wide [&_th:last-child]:pr-wide",
					className,
				)}
				style={width === undefined ? style : { ...style, width }}
				{...props}
			/>
		</div>
	);
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
	return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
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
		<tbody
			data-slot="table-body"
			className={cn("transition-opacity [&_tr:last-child]:border-0", dimmed && "opacity-60", className)}
			{...props}
		/>
	);
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
	return (
		<tfoot
			data-slot="table-footer"
			className={cn("border-t bg-monti-inset font-medium [&>tr]:last:border-b-0", className)}
			{...props}
		/>
	);
}

function TableRow({
	className,
	selected,
	...props
}: React.ComponentProps<"tr"> & {
	/** A row the writer picked (checked for a bulk action, or open in a side panel). */
	selected?: boolean;
}) {
	return (
		<tr
			data-slot="table-row"
			data-selected={selected || undefined}
			aria-selected={selected || undefined}
			className={cn(
				props.onClick && "cursor-pointer",
				"border-b transition-colors hover:bg-monti-hover has-aria-expanded:bg-monti-hover data-selected:bg-monti-selected",
				className,
			)}
			{...props}
		/>
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
	tone?: "muted";
}
const COLUMN_WIDTH = { xs: "w-14", sm: "w-24", md: "w-28", lg: "w-40" } as const;
const ALIGN = { start: "text-left", center: "text-center", end: "text-right tabular" } as const;

function TableHead({
	className,
	align = "start",
	truncate,
	width,
	size,
	valign,
	tone,
	style,
	...props
}: Omit<React.ComponentProps<"th">, "align"> & CellOptions) {
	return (
		<th
			data-slot="table-head"
			className={cn(
				"h-10 whitespace-nowrap px-2 align-middle text-monti-caption text-monti-muted [&:has([role=checkbox])]:pr-0",
				ALIGN[align],
				truncate && "max-w-0 truncate",
				width && COLUMN_WIDTH[width],
				valign === "top" && "align-top",
				tone === "muted" && "text-monti-muted",
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
	style,
	...props
}: Omit<React.ComponentProps<"td">, "align"> & CellOptions) {
	return (
		<td
			data-slot="table-cell"
			className={cn(
				"whitespace-nowrap p-2 align-middle [&:has([role=checkbox])]:pr-0",
				ALIGN[align],
				truncate && "max-w-0 truncate",
				width && COLUMN_WIDTH[width],
				valign === "top" && "align-top",
				wrap && "whitespace-normal break-words",
				tone === "muted" && "text-monti-muted",
				className,
			)}
			style={size === undefined ? style : { ...style, width: size }}
			{...props}
		/>
	);
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
	return (
		<caption data-slot="table-caption" className={cn("mt-4 text-monti-body text-monti-muted", className)} {...props} />
	);
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
