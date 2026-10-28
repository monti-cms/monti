"use client";

import { OverflowMenuHorizontal } from "@carbon/icons-react";
import type * as React from "react";
import { Checkbox } from "./checkbox";
import { cn } from "./cn";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./dropdown-menu";
import type { SelectAll } from "./page-header";
import { ToolbarDivider } from "./page-header";
import { Spark } from "./spark";
import { TableHead, TableHeader } from "./table";
import { TextButton } from "./text-button";

/**
 * What replaces a list's head row once rows are picked, in the same place: the same 40px with the same line under it, so the rows below do not move. How many
 * are picked, the assistant's request on them, the actions used most (as `children`, text buttons and menu buttons), a ⋯ with the rest (the dangerous one
 * last, in red), and at the end the way to let go. The select-all hangs in the left margin, on the line of the rows' checks, and is always shown.
 * It is a row of the list's table, so it spans the table's `colSpan` columns; the table keeps its widths from its columns, not from this row.
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
	/** Asks the assistant to work on the picked rows: a spark and its label. */
	request?: { label: string; onClick: () => void };
	/** The less frequent actions: `label` names the ⋯ for screen readers, `children` are the menu's rows. */
	more?: { label: string; children: React.ReactNode };
	selectAll?: SelectAll;
	/** The text of the button that clears the pick. */
	clearLabel: string;
	onClear: () => void;
	/** How many columns the table has, the ⋯ column included. */
	colSpan: number;
	/** The actions used most. */
	children?: React.ReactNode;
}) {
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
								<ToolbarDivider />
								<TextButton
									onClick={request.onClick}
									className="inline-flex items-center gap-monti-4 text-monti-proposal"
								>
									<Spark className="size-monti-icon-xs" />
									{request.label}
								</TextButton>
							</>
						)}
						{(children || more) && <ToolbarDivider />}
						{children}
						{more && (
							<>
								{children && <ToolbarDivider />}
								<DropdownMenu>
									<DropdownMenuTrigger
										aria-label={more.label}
										className="flex size-6 cursor-pointer items-center justify-center rounded-monti-full border-0 bg-transparent p-0 text-monti-muted outline-none hover:bg-monti-selected focus-visible:ring-2 focus-visible:ring-monti-contrast/20 aria-expanded:bg-monti-selected"
									>
										<OverflowMenuHorizontal aria-hidden className="size-4" />
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start">{more.children}</DropdownMenuContent>
								</DropdownMenu>
							</>
						)}
						<TextButton onClick={onClear} className="ml-auto text-monti-subtle">
							{clearLabel}
						</TextButton>
					</div>
				</TableHead>
			</tr>
		</TableHeader>
	);
}

export { BulkBar };
