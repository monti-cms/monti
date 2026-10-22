"use client";

import { PAGE_SIZES, type PageSize, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Button,
	Inline,
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationNext,
	PaginationPrevious,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Text,
} from "@monti-cms/ui";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { uiMessages } from "../../ui/messages";
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
			<Inline as="nav" gap="tight" aria-label={t("pagination.label")}>
				<Button
					type="button"
					variant="ghost"
					aria-label={t("pagination.previousPage")}
					disabled={page <= 1}
					onClick={() => onPageChange(page - 1)}
				>
					<ChevronLeftIcon data-icon="inline-start" />
					<Box as="span" hideBelow="sm">
						{t("pagination.previous")}
					</Box>
				</Button>
				<Box as="span" paddingX="condensed">
					{page} / {totalPages}
				</Box>
				<Button
					type="button"
					variant="ghost"
					aria-label={t("pagination.nextPage")}
					disabled={page >= totalPages}
					onClick={() => onPageChange(page + 1)}
				>
					<Box as="span" hideBelow="sm">
						{t("pagination.next")}
					</Box>
					<ChevronRightIcon data-icon="inline-end" />
				</Button>
			</Inline>
		);
	}
	return (
		<Pagination>
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious
						href={hrefFor(page - 1)}
						aria-disabled={page <= 1}
						disabled={page <= 1}
						onClick={(event) => {
							event.preventDefault();
							if (page > 1) onPageChange(page - 1);
						}}
					/>
				</PaginationItem>
				<PaginationItem>
					<Box as="span" paddingX="condensed">
						{page} / {totalPages}
					</Box>
				</PaginationItem>
				<PaginationItem>
					<PaginationNext
						href={hrefFor(page + 1)}
						aria-disabled={page >= totalPages}
						disabled={page >= totalPages}
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
export function ListFooter({
	children,
	end,
}: {
	children: React.ReactNode /** Only controls: put them at the right. */;
	end?: boolean;
}) {
	return (
		<Inline
			gap="normal"
			justify={end ? "end" : "between"}
			shrink={false}
			border="top"
			paddingX="wide"
			paddingY="condensed"
		>
			{children}
		</Inline>
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
	showPageSize = true,
	hidePagerWhenSingle = false,
	showRange = true,
}: {
	total: number;
	/** Rows on the current page. */
	shown: number;
	page: number;
	pageSize: PageSize;
	onPageChange: (page: number) => void;
	/** Needed only with the page size control. */
	onPageSizeChange?: (size: PageSize) => void;
	hrefFor?: (page: number) => string;
	/** Screen-specific controls placed before the page size. */
	leading?: React.ReactNode;
	/** `false` when the screen offers the page size somewhere else. */
	showPageSize?: boolean;
	/** Draw no pager when everything fits on one page. */
	hidePagerWhenSingle?: boolean;
	/** `false` when the screen shows the total elsewhere (the status bar): the footer then holds only the controls, and is left out when there are none. */
	showRange?: boolean;
}) {
	const t = useTranslator(screensMessages);
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const showPager = !(hidePagerWhenSingle && totalPages === 1);
	if (!showRange && !showPager && !leading && !showPageSize) return null;
	return (
		<ListFooter end={!showRange}>
			{showRange && (
				<Text variant="caption" tone="muted">
					{t("list.range", {
						total,
						range: shown > 0 ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}` : "0",
					})}
				</Text>
			)}
			<Inline gap="condensed">
				{leading}
				{showPageSize && (
					<Select
						value={String(pageSize)}
						items={PAGE_SIZES.map((size) => ({ value: String(size), label: t("list.pageSizeOption", { size }) }))}
						onValueChange={(value) => value && onPageSizeChange?.(Number(value) as PageSize)}
					>
						<SelectTrigger size="sm" variant="ghost" aria-label={t("list.pageSize")}>
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
				)}
				{showPager && <ListPager page={page} totalPages={totalPages} onPageChange={onPageChange} hrefFor={hrefFor} />}
			</Inline>
		</ListFooter>
	);
}
