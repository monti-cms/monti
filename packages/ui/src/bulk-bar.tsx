"use client";

import type * as React from "react";
import { Checkbox } from "./checkbox";
import { cn } from "./cn";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./dropdown-menu";
import { IconButton } from "./icon-button";
import { OverflowMenuHorizontal } from "./icons";
import { PageToolbar, type SelectAll } from "./page-header";
import { Separator } from "./separator";
import { Spark } from "./spark";
import { TableHead, TableHeader } from "./table";
import { TextButton } from "./text-button";

/**
 * What replaces a list's head once rows or tiles are picked, in the same place, so what is below does not move. How many are picked in bold, the assistant's
 * request on them, the actions used most (as `children`, text buttons and menu buttons), a ⋯ with the rest (the dangerous one last, in red), and at the end the
 * way to let go. The select-all hangs in the left margin, on the line of the rows' checks, and is always shown.
 *
 * Over a table (`colSpan` given) it is a row of the table's head: the same 40px with the same line under it, spanning `colSpan` columns; the table keeps its
 * widths from its columns, not from this row. Over a grid of tiles (no `colSpan`), which has no head row, it takes the place of the filter row: a toolbar row
 * of the same 48px and the same line.
 */
function BulkBar({
	label,
	request,
	more,
	selectAll,
	clearLabel,
	onClear,
	colSpan,
	children,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "children"> & {
	/** How many are picked ("3 selected"). */
	label: string;
	/** Asks the assistant to work on the picked rows ("✦ Ask", "✦ Alt text"): first after the count, in the proposal blue. */
	request?: { label: string; onClick: () => void };
	/** The less frequent actions: `label` names the ⋯, `children` are the menu's rows. */
	more?: { label: string; children: React.ReactNode };
	selectAll?: SelectAll;
	/** The text of the button that clears the pick. */
	clearLabel: string;
	onClear: () => void;
	/** Over a table: how many columns it has, the ⋯ column included. Leave it out over a grid. */
	colSpan?: number;
	/** The actions used most. */
	children?: React.ReactNode;
}) {
	const content = (
		<>
			{selectAll && (
				<span data-slot="select-all" className="absolute top-1/2 -left-[26px] z-1 flex -translate-y-1/2">
					<Checkbox
						checked={selectAll.state === "all"}
						indeterminate={selectAll.state === "some"}
						onCheckedChange={(next) => selectAll.onChange(next === true)}
						aria-label={selectAll.label}
						className="bg-monti-page"
					/>
				</span>
			)}
			<span className="font-bold text-monti-default">{label}</span>
			{request && (
				<>
					<Separator orientation="vertical" length="control" flush />
					<TextButton tone="proposal" onClick={request.onClick}>
						<Spark />
						{request.label}
					</TextButton>
				</>
			)}
			{(children || more) && <Separator orientation="vertical" length="control" flush />}
			{children}
			{more && (
				<>
					{children && <Separator orientation="vertical" length="control" flush />}
					<DropdownMenu>
						<IconButton label={more.label} trigger={(button) => <DropdownMenuTrigger render={button} />}>
							<OverflowMenuHorizontal aria-hidden />
						</IconButton>
						<DropdownMenuContent align="start">{more.children}</DropdownMenuContent>
					</DropdownMenu>
				</>
			)}
			<TextButton variant="quiet" onClick={onClear} className="ml-auto">
				{clearLabel}
			</TextButton>
		</>
	);
	if (colSpan === undefined)
		return (
			<PageToolbar
				inset
				data-slot="bulk-bar"
				role="toolbar"
				aria-label={label}
				className={cn("relative text-monti-body text-monti-default", className)}
				{...props}
			>
				{content}
			</PageToolbar>
		);
	return (
		<TableHeader>
			<tr>
				<TableHead colSpan={colSpan} className="relative p-0 first:pl-0 last:pr-0">
					<div
						data-slot="bulk-bar"
						role="toolbar"
						aria-label={label}
						className={cn(
							"flex h-full min-h-0 items-center gap-monti-20 px-monti-12 font-normal text-monti-body text-monti-default",
							className,
						)}
						{...props}
					>
						{content}
					</div>
				</TableHead>
			</tr>
		</TableHeader>
	);
}

export { BulkBar };
