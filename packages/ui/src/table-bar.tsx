"use client";

import { MoreHorizontal } from "lucide-react";
import type * as React from "react";
import { Spark } from "./ai-action";
import { Checkbox } from "./checkbox";
import { cn } from "./cn";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./dropdown-menu";
import { TextButton } from "./text-button";

/** What a bar's select-all shows: nothing picked, some of this page picked, all of it. */
type SelectAllState = "none" | "some" | "all";

type SelectAll = {
	state: SelectAllState;
	/** Called with `true` to pick this page (every row of it, not the whole list), `false` to clear. */
	onChange: (all: boolean) => void;
	/** The name of the check, for screen readers ("Select all"). */
	label: string;
};

/**
 * The select-all of a list: it hangs 26px outside the bar's left edge, on the line of the rows' checks. It is hidden while nothing is picked and
 * shows when the pointer is on the bar. It shows a bar while only some rows of the page are picked and a ✓ when all of them are.
 */
function SelectAllCheck({ selectAll }: { selectAll: SelectAll }) {
	return (
		<span
			data-slot="select-all"
			className={cn(
				"absolute top-1/2 -left-[26px] flex -translate-y-1/2 pointer-coarse:opacity-100 focus-within:opacity-100",
				selectAll.state === "none" ? "opacity-0 group-hover/bar:opacity-100" : "opacity-100",
			)}
		>
			<Checkbox
				checked={selectAll.state === "all"}
				indeterminate={selectAll.state === "some"}
				onCheckedChange={(next) => selectAll.onChange(next === true)}
				aria-label={selectAll.label}
				className="bg-monti-page"
			/>
		</span>
	);
}

/**
 * The row above a list (tabs, filters, a group's name, the pager): inside the same 12px as the rows, so the first letters line up with theirs.
 * Its rules run to the edge. With `selectAll` it carries the select-all check in the left margin. The table must not scroll itself, or the margin
 * is cut off.
 */
function TableBar({
	selectAll,
	className,
	children,
	...props
}: React.ComponentProps<"div"> & {
	selectAll?: SelectAll;
}) {
	return (
		<div
			data-slot="table-bar"
			className={cn("group/bar relative flex min-h-monti-control items-center gap-monti-16 px-monti-12", className)}
			{...props}
		>
			{selectAll && <SelectAllCheck selectAll={selectAll} />}
			{children}
		</div>
	);
}

const DIVIDER = <span aria-hidden className="h-3.5 shrink-0 border-monti-default border-l" />;

/**
 * What replaces a list's filter row once rows are picked: how many, the assistant's request on them, the two actions used most (as `children`,
 * text buttons), a ⋯ with the rest (the dangerous one last, in red), and at the end the way to let go. The select-all stays where it was.
 */
function BulkBar({
	label,
	request,
	more,
	selectAll,
	clearLabel,
	onClear,
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
	/** The two actions used most. */
	children?: React.ReactNode;
}) {
	return (
		<TableBar
			role="toolbar"
			aria-label={label}
			selectAll={selectAll}
			className={cn("text-monti-body", className)}
			{...props}
		>
			<span className="text-monti-default">{label}</span>
			{request && (
				<>
					{DIVIDER}
					<TextButton onClick={request.onClick} className="inline-flex items-center gap-monti-4 text-monti-proposal">
						<Spark />
						{request.label}
					</TextButton>
				</>
			)}
			{(children || more) && DIVIDER}
			{children && <span className="flex items-center gap-monti-16">{children}</span>}
			{more && (
				<DropdownMenu>
					<DropdownMenuTrigger
						aria-label={more.label}
						className="flex size-6 cursor-pointer items-center justify-center rounded-monti-full border-0 bg-transparent p-0 text-monti-muted outline-none hover:bg-monti-selected focus-visible:ring-2 focus-visible:ring-monti-contrast/20 aria-expanded:bg-monti-selected"
					>
						<MoreHorizontal aria-hidden className="size-4" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">{more.children}</DropdownMenuContent>
				</DropdownMenu>
			)}
			<TextButton onClick={onClear} className="ml-auto text-monti-subtle">
				{clearLabel}
			</TextButton>
		</TableBar>
	);
}

export { BulkBar, TableBar };
export type { SelectAll, SelectAllState };
