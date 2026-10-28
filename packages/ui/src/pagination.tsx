"use client";

import { ChevronLeft, ChevronRight } from "@carbon/icons-react";
import type * as React from "react";
import { cn } from "./cn";
import { useUiLabels } from "./labels";

/** The pager of a list, at the right end of the row under the table (the range, "1–25 / 148", goes at the left). */
function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
	const labels = useUiLabels();
	return (
		<nav
			role="navigation"
			aria-label={labels.paginationLabel}
			data-slot="pagination"
			className={cn("ml-auto flex w-fit", className)}
			{...props}
		/>
	);
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
	return <ul data-slot="pagination-content" className={cn("flex items-center gap-monti-4", className)} {...props} />;
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
	return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = {
	isActive?: boolean;
	/** The first page's "previous" and the last page's "next": dimmed to .45, not followed and not reached with the keyboard. */
	disabled?: boolean;
} & React.ComponentProps<"a">;

/** A page button: 32px tall and never narrower, so one digit is a circle and more digits a pill. The current page has the selected background and is semibold. */
function PaginationLink({ className, isActive, disabled, ...props }: PaginationLinkProps) {
	return (
		<a
			aria-current={isActive ? "page" : undefined}
			aria-disabled={disabled || undefined}
			tabIndex={disabled ? -1 : undefined}
			data-slot="pagination-link"
			data-active={isActive}
			className={cn(
				"inline-flex h-monti-icon-button shrink-0 cursor-pointer items-center justify-center gap-monti-4 rounded-monti-full text-monti-body text-monti-muted no-underline outline-none transition-colors hover:bg-monti-selected hover:text-monti-default focus-visible:ring-3 focus-visible:ring-monti-contrast/20 data-[active=true]:bg-monti-selected data-[active=true]:font-semibold data-[active=true]:text-monti-default [&_svg:not([class*='size-'])]:size-4",
				// A page button is never narrower than tall: one digit is a circle, more digits a pill.
				"min-w-(--size-monti-icon-button) px-monti-4",
				disabled && "pointer-events-none opacity-45",
				className,
			)}
			{...props}
		/>
	);
}

function PaginationPrevious({
	className,
	text,
	...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
	const labels = useUiLabels();
	text ??= labels.paginationPrevious;
	return (
		<PaginationLink
			aria-label={labels.paginationPreviousPage}
			className={cn("px-monti-12 pl-monti-8", className)}
			{...props}
		>
			<ChevronLeft data-icon="inline-start" />
			<span>{text}</span>
		</PaginationLink>
	);
}

function PaginationNext({
	className,
	text,
	...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
	const labels = useUiLabels();
	text ??= labels.paginationNext;
	return (
		<PaginationLink
			aria-label={labels.paginationNextPage}
			className={cn("px-monti-12 pr-monti-8", className)}
			{...props}
		>
			<span>{text}</span>
			<ChevronRight data-icon="inline-end" />
		</PaginationLink>
	);
}

/** The gap in a long run of pages: "…" in the quiet color, in a box as big as a page button. */
function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
	const labels = useUiLabels();
	return (
		<span
			data-slot="pagination-ellipsis"
			className={cn(
				"flex size-monti-icon-button items-center justify-center text-monti-body text-monti-subtle",
				className,
			)}
			{...props}
		>
			<span aria-hidden>…</span>
			<span className="sr-only">{labels.paginationMore}</span>
		</span>
	);
}

/**
 * The row under a table: the shown range ("1–25 / 148", a `Count`) at the left, the {@link Pagination} at the right. It sits 12px inside like the rows, so
 * the range starts under the first letters of the table, and 12px under it.
 */
function ListFooter({ className, ...props }: React.ComponentProps<"footer">) {
	return (
		<footer
			data-slot="list-footer"
			className={cn("flex items-center gap-monti-16 px-monti-12 pt-monti-12", className)}
			{...props}
		/>
	);
}

export {
	ListFooter,
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
};
