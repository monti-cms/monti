import type * as React from "react";
import { Checkbox } from "./checkbox";
import { cn } from "./cn";

/**
 * The head of a content page: the title (26px bold) with the ink rule under it, the only heavy line of a page. `meta` is what sits beside the title
 * in mono (the list's address rule, a count); `children` are the page's actions on the right, the secondary pill first and the one primary pill last.
 */
function PageHeader({
	title,
	meta,
	className,
	children,
	...props
}: Omit<React.ComponentProps<"header">, "title"> & {
	title: React.ReactNode;
	meta?: React.ReactNode;
}) {
	return (
		<header
			data-slot="page-header"
			className={cn("flex flex-wrap items-end gap-monti-12 border-monti-contrast border-b pb-[18px]", className)}
			{...props}
		>
			<h1 className="text-monti-page">{title}</h1>
			{meta && <span className="pb-[3px] font-mono text-monti-body text-monti-faint">{meta}</span>}
			{children && <span className="ml-auto flex items-center gap-monti-16">{children}</span>}
		</header>
	);
}

/** What a toolbar's select-all shows: nothing picked, some of this page picked, all of it. */
type SelectAllState = "none" | "some" | "all";

type SelectAll = {
	state: SelectAllState;
	/** Called with `true` to pick this page (every row of it, not the whole list), `false` to clear. */
	onChange: (all: boolean) => void;
	/** The name of the check, for screen readers ("Select all"). */
	label: string;
};

/**
 * The select-all of a list: it hangs 26px outside the toolbar's left edge, on the line of the rows' checks, level with the toolbar's first line (24px down, half of 48) even when a narrow toolbar wraps onto a second. It is hidden while nothing is picked
 * and shows when the pointer is on the toolbar. It shows a bar while only some rows of the page are picked and a ✓ when all of them are.
 */
function SelectAllCheck({ selectAll }: { selectAll: SelectAll }) {
	return (
		<span
			data-slot="select-all"
			className={cn(
				"absolute top-6 -left-[26px] flex -translate-y-1/2 pointer-coarse:opacity-100 focus-within:opacity-100",
				selectAll.state === "none" ? "opacity-0 group-hover/toolbar:opacity-100" : "opacity-100",
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
 * The row under the page title: tabs on the left, filters on the right ({@link PageToolbarEnd}), 48px high with a rule below. Once rows are picked
 * the same place becomes the bulk bar. Over a table, `inset` pulls it 12px inside like the rows, so the first letters line up with theirs while its
 * rule runs to the edge, and `selectAll` hangs the select-all check in the left margin (the table must not scroll itself, or the margin is cut off).
 */
function PageToolbar({
	inset = false,
	selectAll,
	className,
	children,
	...props
}: React.ComponentProps<"div"> & {
	inset?: boolean;
	selectAll?: SelectAll;
}) {
	return (
		<div
			data-slot="page-toolbar"
			className={cn(
				"group/toolbar relative flex min-h-monti-toolbar flex-wrap items-center gap-monti-20 border-monti-default border-b",
				inset && "px-monti-12",
				className,
			)}
			{...props}
		>
			{selectAll && <SelectAllCheck selectAll={selectAll} />}
			{children}
		</div>
	);
}

/** The right group of a toolbar: filters, or the way to let go of a pick. */
function PageToolbarEnd({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span data-slot="page-toolbar-end" className={cn("ml-auto flex items-center gap-monti-20", className)} {...props} />
	);
}

/** A short vertical rule between two groups of a toolbar. */
function ToolbarDivider({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="toolbar-divider"
			aria-hidden
			className={cn("h-3.5 shrink-0 border-monti-default border-l", className)}
			{...props}
		/>
	);
}

export { PageHeader, PageToolbar, PageToolbarEnd, type SelectAll, type SelectAllState, ToolbarDivider };
