"use client";

import { PAGE_SIZES, type PageSize, useTranslator } from "@monti-cms/core/site";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { uiMessages } from "../../ui/messages";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { screensMessages } from "../messages";

/** Previous / page of pages / next, as used at the bottom of every paged list. */
export function ListPager({
	page,
	totalPages,
	onPageChange,
	hrefFor,
}: {
	page: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	/** Address of a page, so the controls are real links. Without it they are buttons. */
	hrefFor?: (page: number) => string;
}) {
	const t = useTranslator(uiMessages);
	if (!hrefFor) {
		// Without addresses the controls are buttons, not anchors that go nowhere.
		return (
			<nav aria-label={t("pagination.label")} className="flex items-center gap-1">
				<Button
					type="button"
					variant="ghost"
					aria-label={t("pagination.previousPage")}
					disabled={page <= 1}
					onClick={() => onPageChange(page - 1)}
				>
					<ChevronLeftIcon data-icon="inline-start" />
					<span className="hidden sm:block">{t("pagination.previous")}</span>
				</Button>
				<span className="px-2 tabular-nums">
					{page} / {totalPages}
				</span>
				<Button
					type="button"
					variant="ghost"
					aria-label={t("pagination.nextPage")}
					disabled={page >= totalPages}
					onClick={() => onPageChange(page + 1)}
				>
					<span className="hidden sm:block">{t("pagination.next")}</span>
					<ChevronRightIcon data-icon="inline-end" />
				</Button>
			</nav>
		);
	}
	return (
		<Pagination className="mx-0 w-auto">
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious
						href={hrefFor(page - 1)}
						aria-disabled={page <= 1}
						className={cn(page <= 1 && "pointer-events-none opacity-50")}
						onClick={(event) => {
							event.preventDefault();
							if (page > 1) onPageChange(page - 1);
						}}
					/>
				</PaginationItem>
				<PaginationItem>
					<span className="px-2 tabular-nums">
						{page} / {totalPages}
					</span>
				</PaginationItem>
				<PaginationItem>
					<PaginationNext
						href={hrefFor(page + 1)}
						aria-disabled={page >= totalPages}
						className={cn(page >= totalPages && "pointer-events-none opacity-50")}
						onClick={(event) => {
							event.preventDefault();
							if (page < totalPages) onPageChange(page + 1);
						}}
					/>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}

/** The bar pinned to the bottom of a list screen: a summary on the left, controls on the right. */
export function ListFooter({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<div
			className={cn(
				"flex h-12 shrink-0 items-center justify-between gap-3 border-t px-5 text-monti-muted-foreground text-xs",
				className,
			)}
		>
			{children}
		</div>
	);
}

/**
 * The footer of every paged list (entries, trash, media, events): the shown range on the left; on the right optional extra controls,
 * the page size and the pager.
 */
export function ListPagination({
	total,
	shown,
	page,
	pageSize,
	onPageChange,
	onPageSizeChange,
	hrefFor,
	leading,
}: {
	total: number;
	/** Rows on the current page. */
	shown: number;
	page: number;
	pageSize: PageSize;
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: PageSize) => void;
	hrefFor?: (page: number) => string;
	/** Screen-specific controls placed before the page size. */
	leading?: React.ReactNode;
}) {
	const t = useTranslator(screensMessages);
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	return (
		<ListFooter>
			<span className="tabular">
				{t("list.range", {
					total,
					range: shown > 0 ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}` : "0",
				})}
			</span>
			<div className="flex items-center gap-2">
				{leading}
				<Select
					value={String(pageSize)}
					items={PAGE_SIZES.map((size) => ({ value: String(size), label: t("list.pageSizeOption", { size }) }))}
					onValueChange={(value) => value && onPageSizeChange(Number(value) as PageSize)}
				>
					<SelectTrigger size="sm" aria-label={t("list.pageSize")} className="h-7 border-0 text-xs shadow-none">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{PAGE_SIZES.map((size) => (
							<SelectItem key={size} value={String(size)}>
								{t("list.pageSizeOption", { size })}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<ListPager page={page} totalPages={totalPages} onPageChange={onPageChange} hrefFor={hrefFor} />
			</div>
		</ListFooter>
	);
}
