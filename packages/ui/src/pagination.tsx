"use client";

import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "./cn";
import { useUiLabels } from "./labels";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
	const labels = useUiLabels();
	return (
		<nav
			role="navigation"
			aria-label={labels.paginationLabel}
			data-slot="pagination"
			className={cn("mx-auto flex w-full justify-center", className)}
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
	/** The first page's "previous" and the last page's "next": shown, not followed. */
	disabled?: boolean;
	/** `icon` a round 32px mark for a page number; `default` wider, with a word and an arrow. */
	size?: "icon" | "default";
} & React.ComponentProps<"a">;

function PaginationLink({ className, isActive, disabled, size = "icon", ...props }: PaginationLinkProps) {
	return (
		<a
			aria-current={isActive ? "page" : undefined}
			aria-disabled={disabled || undefined}
			tabIndex={disabled ? -1 : undefined}
			data-slot="pagination-link"
			data-active={isActive}
			className={cn(
				"inline-flex h-monti-icon shrink-0 cursor-pointer items-center justify-center gap-monti-4 rounded-monti-full text-monti-body text-monti-muted no-underline outline-none transition-colors hover:bg-monti-selected hover:text-monti-default focus-visible:ring-3 focus-visible:ring-monti-contrast/20 data-[active=true]:bg-monti-selected data-[active=true]:font-semibold data-[active=true]:text-monti-default [&_svg:not([class*='size-'])]:size-4",
				size === "icon" ? "min-w-monti-icon px-monti-4" : "px-monti-12",
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
			size="default"
			className={cn("pl-monti-8", className)}
			{...props}
		>
			<ChevronLeftIcon data-icon="inline-start" />
			<span className="hidden sm:block">{text}</span>
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
			size="default"
			className={cn("pr-monti-8", className)}
			{...props}
		>
			<span className="hidden sm:block">{text}</span>
			<ChevronRightIcon data-icon="inline-end" />
		</PaginationLink>
	);
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
	const labels = useUiLabels();
	return (
		<span
			aria-hidden
			data-slot="pagination-ellipsis"
			className={cn("flex size-monti-icon items-center justify-center [&_svg:not([class*='size-'])]:size-4", className)}
			{...props}
		>
			<MoreHorizontalIcon />
			<span className="sr-only">{labels.paginationMore}</span>
		</span>
	);
}

export {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
};
