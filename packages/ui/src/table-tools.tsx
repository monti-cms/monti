"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { ReactElement } from "react";
import { cn } from "./cn";
import { Add, Draggable } from "./icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/**
 * A grip on a table's edge in the editor (editor-tools.md, the table): on the top edge of the caret's column, or the left edge of its row. A quiet
 * pill with the drag mark, a step darker (`bg-selected`) when pointed at, its name in a tooltip; pressing it opens the column's or row's menu, and while that is open (`active`) it is ink. To make it a menu's trigger,
 * wrap it with `trigger`: `trigger={(grip) => <DropdownMenuTrigger render={grip} />}`.
 */
function TableGrip({
	along,
	label,
	active = false,
	trigger,
	className,
	...props
}: Omit<ButtonPrimitive.Props, "aria-label" | "children"> & {
	/** `column`: a wide pill on the top edge. `row`: a tall one on the left edge. */
	along: "column" | "row";
	/** The grip's name for screen readers ("Column 2"). */
	label: string;
	active?: boolean;
	trigger?: (grip: ReactElement) => ReactElement;
}) {
	const grip = (
		<ButtonPrimitive
			data-slot="table-grip"
			type="button"
			aria-label={label}
			data-active={active || undefined}
			className={cn(
				"flex cursor-pointer items-center justify-center rounded-monti-full border-0 bg-monti-muted p-0 text-monti-subtle outline-none transition-colors hover:bg-monti-selected hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/50 aria-expanded:bg-monti-emphasis aria-expanded:text-monti-on-emphasis data-active:bg-monti-emphasis data-active:text-monti-on-emphasis",
				along === "column" ? "h-monti-12 w-monti-20" : "h-monti-20 w-monti-12",
				className,
			)}
			// Pressing it keeps the caret in its cell.
			onMouseDown={(event) => event.preventDefault()}
			{...props}
		>
			<Draggable aria-hidden className={cn("size-3", along === "column" && "rotate-90")} />
		</ButtonPrimitive>
	);
	return (
		<Tooltip>
			<TooltipTrigger render={trigger ? trigger(grip) : grip} />
			<TooltipContent side={along === "column" ? "top" : "left"}>{label}</TooltipContent>
		</Tooltip>
	);
}

/**
 * The + strip along a table's right edge (a column) or bottom edge (a row), shown while the pointer is over the table, its name in a tooltip. It fills the box it is put in
 * (`EditorOverlay` with the table's height or width).
 */
function TableAddStrip({
	label,
	className,
	...props
}: Omit<ButtonPrimitive.Props, "aria-label" | "children"> & {
	/** What it adds, for screen readers and the tooltip ("Add a column"). */
	label: string;
}) {
	const strip = (
		<ButtonPrimitive
			data-slot="table-add-strip"
			type="button"
			aria-label={label}
			className={cn(
				"flex size-full cursor-pointer items-center justify-center rounded-monti-full border-0 bg-monti-muted p-0 text-monti-subtle outline-none transition-colors hover:bg-monti-selected hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/50",
				className,
			)}
			onMouseDown={(event) => event.preventDefault()}
			{...props}
		>
			<Add aria-hidden className="size-3.5" />
		</ButtonPrimitive>
	);
	return (
		<Tooltip>
			<TooltipTrigger render={strip} />
			<TooltipContent side="top">{label}</TooltipContent>
		</Tooltip>
	);
}

/**
 * The border between two columns of a table in the editor, to drag wider or narrower: a thin hit area over the border that shows a 2px ink line
 * while it is pointed at, focused or dragged (`active`). The two columns beside it trade width; the table stays as wide as the body. It fills the box
 * it is put in (`EditorOverlay` with the table's height). The arrow keys move it too.
 */
function TableColumnBorder({
	label,
	active = false,
	className,
	...props
}: Omit<ButtonPrimitive.Props, "aria-label" | "children"> & {
	/** What it does, for screen readers ("Resize columns 2 and 3"). */
	label: string;
	/** Being dragged: the line stays while the pointer moves. */
	active?: boolean;
}) {
	return (
		<ButtonPrimitive
			data-slot="table-column-border"
			type="button"
			aria-label={label}
			data-active={active || undefined}
			className={cn(
				"group relative flex size-full cursor-col-resize items-stretch justify-center rounded-monti-full border-0 bg-transparent p-0 outline-none",
				className,
			)}
			onMouseDown={(event) => event.preventDefault()}
			{...props}
		>
			<span className="w-0.5 bg-transparent transition-colors group-hover:bg-monti-emphasis group-focus-visible:bg-monti-emphasis group-data-active:bg-monti-emphasis" />
		</ButtonPrimitive>
	);
}

export { TableAddStrip, TableColumnBorder, TableGrip };
