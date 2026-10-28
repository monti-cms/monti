"use client";

import { PAGE_SIZES, type PageSize, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Count,
	Inline,
	ListFooter,
	PageSizeMenu,
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@monti-cms/ui";
import { screensMessages } from "../messages";
import { pageWindow } from "./page-window";

/** Previous, the page buttons (the first, the current with its neighbours, the last), next. The ends dim and cannot be followed when there is nowhere to go. */
export function ListPager({
	page,
	totalPages,
	onPageChange,
	hrefFor,
}: {
	page: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	/** Address of a page, so the buttons are real links. Without it they only change the page. */
	hrefFor?: (page: number) => string;
}) {
	const go = (target: number) => ({
		href: hrefFor?.(target) ?? "#",
		onClick: (event: React.MouseEvent) => {
			event.preventDefault();
			if (target >= 1 && target <= totalPages && target !== page) onPageChange(target);
		},
	});
	return (
		<Pagination>
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious disabled={page <= 1} {...go(page - 1)} />
				</PaginationItem>
				{pageWindow(page, totalPages).map((entry, index) => (
					<PaginationItem key={entry === "gap" ? `gap-${index}` : entry}>
						{entry === "gap" ? (
							<PaginationEllipsis />
						) : (
							<PaginationLink isActive={entry === page} {...go(entry)}>
								{entry}
							</PaginationLink>
						)}
					</PaginationItem>
				))}
				<PaginationItem>
					<PaginationNext disabled={page >= totalPages} {...go(page + 1)} />
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}

/**
 * The footer of every paged list (entries, trash, media, events): the shown range on the left with the page size beside it (when the screen lets the
 * writer change it); on the right optional extra controls and the pager.
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
	hidePagerWhenSingle = false,
	showRange = true,
}: {
	total: number;
	/** Rows on the current page. */
	shown: number;
	page: number;
	pageSize: PageSize;
	onPageChange: (page: number) => void;
	/** Shows the page size beside the range, and what picking a size does. */
	onPageSizeChange?: (size: PageSize) => void;
	hrefFor?: (page: number) => string;
	/** Screen-specific controls placed before the pager. */
	leading?: React.ReactNode;
	/** Draw no pager when everything fits on one page. */
	hidePagerWhenSingle?: boolean;
	/** `false` when the screen shows the total elsewhere (the status bar): the footer then holds only the controls, and is left out when there are none. */
	showRange?: boolean;
}) {
	const t = useTranslator(screensMessages);
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const showPager = !(hidePagerWhenSingle && totalPages === 1);
	if (!showRange && !showPager && !leading && !onPageSizeChange) return null;
	return (
		<Box shrink={false}>
			<ListFooter>
				{showRange && (
					<Count>
						{t("list.range", {
							total,
							range: shown > 0 ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}` : "0",
						})}
					</Count>
				)}
				{onPageSizeChange && (
					<PageSizeMenu
						label={t("list.pageSize")}
						value={pageSize}
						options={PAGE_SIZES.map((size) => ({ value: size, label: t("list.pageSizeOption", { size }) }))}
						onValueChange={(size) => onPageSizeChange(size as PageSize)}
					/>
				)}
				<Inline gap={8} grow justify="end">
					{leading}
					{showPager && <ListPager page={page} totalPages={totalPages} onPageChange={onPageChange} hrefFor={hrefFor} />}
				</Inline>
			</ListFooter>
		</Box>
	);
}
