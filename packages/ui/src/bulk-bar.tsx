"use client";

import * as React from "react";
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

/** What takes Esc for itself: a field, a menu, a dialog, a panel beside the list (an Esc there is the panel's). */
const OWN_ESCAPE =
	"input, textarea, select, [contenteditable], [role=menu], [role=menuitem], [role=dialog], [role=alertdialog], [role=listbox], [role=combobox], aside, [data-slot=side-panel]";
/** What the keyboard stops on, in the head that takes the bar's place. */
const FIRST_STOP = 'button:not([disabled]), [href], [role=checkbox], [tabindex]:not([tabindex="-1"])';

/**
 * What replaces a list's head once rows or tiles are picked, in the same place, so what is below does not move. How many are picked in bold, the assistant's
 * request on them, the actions used most (as `children`, text buttons and menu buttons), a ⋯ with the rest (the dangerous one last, in red), and at the end the
 * way to let go. The select-all hangs in the left margin, on the line of the rows' checks, and is always shown.
 *
 * Over a table (`colSpan` given) it is a row of the table's head: the same 40px with the same line under it, spanning `colSpan` columns; the table keeps its
 * widths from its columns, not from this row. Over a grid of tiles (no `colSpan`), which has no head row, it takes the place of the filter row: a toolbar row
 * of the same 48px and the same line.
 *
 * Esc lets go of the pick, here once for every list: not while the focus is in a field, a menu or a dialog, which take Esc for themselves.
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
	const clear = React.useRef(onClear);
	clear.current = onClear;
	const bar = React.useRef<HTMLDivElement>(null);
	React.useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
			if (event.target instanceof Element && event.target.closest(OWN_ESCAPE)) return;
			const held = bar.current?.contains(document.activeElement) ?? false;
			// What the bar stands in for, by its place: the table's head (its `thead`), or the grid's row of filters. It is what the box it is in
			// draws at that place once the pick is let go.
			const slot = bar.current?.closest("thead") ?? bar.current;
			const box = slot?.parentElement;
			const place = box && slot ? [...box.children].indexOf(slot) : -1;
			clear.current();
			// The bar goes with the pick and takes the focus it held: it goes to the first stop of the head that comes back, not to the page.
			if (held && box && place >= 0)
				requestAnimationFrame(() =>
					requestAnimationFrame(() => {
						if (document.activeElement && document.activeElement !== document.body) return;
						box.children[place]?.querySelector<HTMLElement>(FIRST_STOP)?.focus();
					}),
				);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);
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
			<span className="font-semibold text-monti-default">{label}</span>
			{request && (
				<>
					<Separator orientation="vertical" length="control" flush />
					<TextButton tone="proposal" onClick={request.onClick}>
						<Spark className="size-monti-icon-md" />
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
			{/* A quiet text button: letting go is not one of the actions on the picked rows (components/list.md, bulk bar). */}
			<TextButton variant="quiet" onClick={onClear} className="ml-auto">
				{clearLabel}
			</TextButton>
		</>
	);
	if (colSpan === undefined)
		return (
			<PageToolbar
				inset
				ref={bar}
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
						ref={bar}
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
