"use client";

import type * as React from "react";
import { cn } from "./cn";

function Table({
	className,
	containerClassName,
	...props
}: React.ComponentProps<"table"> & {
	/** Scroll area wrapping the table. If the outside handles scrolling, set `overflow-visible` so the sticky header works. */
	containerClassName?: string;
}) {
	return (
		<div data-slot="table-container" className={cn("relative w-full overflow-x-auto", containerClassName)}>
			<table data-slot="table" className={cn("w-full caption-bottom text-monti-body", className)} {...props} />
		</div>
	);
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
	return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
	return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
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
				"border-b transition-colors hover:bg-monti-hover has-aria-expanded:bg-monti-hover data-selected:bg-monti-selected",
				className,
			)}
			{...props}
		/>
	);
}

/** Where a column's content sits, and whether long content ends in "…" instead of widening the column. */
interface CellOptions {
	align?: "start" | "center" | "end";
	truncate?: boolean;
}
const ALIGN = { start: "text-left", center: "text-center", end: "text-right tabular" } as const;

function TableHead({
	className,
	align = "start",
	truncate,
	...props
}: Omit<React.ComponentProps<"th">, "align"> & CellOptions) {
	return (
		<th
			data-slot="table-head"
			className={cn(
				"h-10 whitespace-nowrap px-2 align-middle text-monti-caption text-monti-muted [&:has([role=checkbox])]:pr-0",
				ALIGN[align],
				truncate && "max-w-0 truncate",
				className,
			)}
			{...props}
		/>
	);
}

function TableCell({
	className,
	align = "start",
	truncate,
	...props
}: Omit<React.ComponentProps<"td">, "align"> & CellOptions) {
	return (
		<td
			data-slot="table-cell"
			className={cn(
				"whitespace-nowrap p-2 align-middle [&:has([role=checkbox])]:pr-0",
				ALIGN[align],
				truncate && "max-w-0 truncate",
				className,
			)}
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
