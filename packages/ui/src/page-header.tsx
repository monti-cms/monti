import type * as React from "react";
import { Checkbox } from "./checkbox";
import { cn } from "./cn";

/**
 * The head of a content page: the title (26px bold) with the ink rule under it, the only heavy line of a page. `meta` is a list's address rule in mono
 * beside the title; `children` are the page's actions on the right, the secondary pill first and the one primary pill last. The title row is as tall
 * as a pill (36px) with or without one, so the rule sits at the same height on every page. `trail` is the way back above the title (a folder path).
 */
function PageHeader({
	title,
	meta,
	trail,
	className,
	children,
	...props
}: Omit<React.ComponentProps<"header">, "title"> & {
	title: React.ReactNode;
	meta?: React.ReactNode;
	trail?: React.ReactNode;
}) {
	return (
		<header
			data-slot="page-header"
			className={cn("shrink-0 border-monti-contrast border-b pb-[18px]", className)}
			{...props}
		>
			{trail && <div className="pb-monti-10 text-monti-faint text-monti-note">{trail}</div>}
			<div className="flex flex-wrap items-end gap-monti-12">
				<h1 className="pt-monti-4 text-monti-page">{title}</h1>
				{meta && <span className="pb-[3px] font-mono text-monti-body text-monti-faint">{meta}</span>}
				{children && <span className="ml-auto flex items-center gap-monti-16">{children}</span>}
			</div>
		</header>
	);
}

/**
 * The column every page sits in: centred, 880px at most, 40px above the title and below the page, and 48px at the sides (16px on a narrow screen). It takes the height
 * the page has. The header and the toolbar keep their place; the body ({@link PageBody}) is what scrolls.
 */
function PageColumn({ className, children, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="page-column"
			className={cn(
				"flex min-h-0 min-w-0 flex-1 flex-col px-monti-16 pt-monti-40 pb-monti-40 md:px-monti-48",
				className,
			)}
			{...props}
		>
			<div className="mx-auto flex min-h-0 w-full max-w-monti-content flex-1 flex-col">{children}</div>
		</div>
	);
}

/** What is under the header and the toolbar of a page: it takes the height left and scrolls by itself (`relative`, so the screen-reader-only inputs inside scroll with it). */
function PageBody({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="page-body"
			className={cn("relative flex min-h-0 flex-1 flex-col overflow-y-auto pb-monti-8", className)}
			{...props}
		/>
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
		<span
			data-slot="page-toolbar-end"
			className={cn("ml-auto flex flex-wrap items-center justify-end gap-x-monti-20 gap-y-monti-8", className)}
			{...props}
		/>
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

export {
	PageBody,
	PageColumn,
	PageHeader,
	PageToolbar,
	PageToolbarEnd,
	type SelectAll,
	type SelectAllState,
	ToolbarDivider,
};
