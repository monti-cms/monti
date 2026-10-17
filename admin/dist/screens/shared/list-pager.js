"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { PAGE_SIZES, useTranslator } from "@monti-cms/core/site";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "../../lib/utils/index.js";
import { Button } from "../../ui/button.js";
import { uiMessages } from "../../ui/messages.js";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../ui/pagination.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select.js";
import { screensMessages } from "../messages.js";
/** Previous / page of pages / next, as used at the bottom of every paged list. */
export function ListPager({ page, totalPages, onPageChange, hrefFor, }) {
    const t = useTranslator(uiMessages);
    if (!hrefFor) {
        // Without addresses the controls are buttons, not anchors that go nowhere.
        return (_jsxs("nav", { "aria-label": t("pagination.label"), className: "flex items-center gap-1", children: [_jsxs(Button, { type: "button", variant: "ghost", "aria-label": t("pagination.previousPage"), disabled: page <= 1, onClick: () => onPageChange(page - 1), children: [_jsx(ChevronLeftIcon, { "data-icon": "inline-start" }), _jsx("span", { className: "hidden sm:block", children: t("pagination.previous") })] }), _jsxs("span", { className: "px-2 tabular-nums", children: [page, " / ", totalPages] }), _jsxs(Button, { type: "button", variant: "ghost", "aria-label": t("pagination.nextPage"), disabled: page >= totalPages, onClick: () => onPageChange(page + 1), children: [_jsx("span", { className: "hidden sm:block", children: t("pagination.next") }), _jsx(ChevronRightIcon, { "data-icon": "inline-end" })] })] }));
    }
    return (_jsx(Pagination, { className: "mx-0 w-auto", children: _jsxs(PaginationContent, { children: [_jsx(PaginationItem, { children: _jsx(PaginationPrevious, { href: hrefFor(page - 1), "aria-disabled": page <= 1, className: cn(page <= 1 && "pointer-events-none opacity-50"), onClick: (event) => {
                            event.preventDefault();
                            if (page > 1)
                                onPageChange(page - 1);
                        } }) }), _jsx(PaginationItem, { children: _jsxs("span", { className: "px-2 tabular-nums", children: [page, " / ", totalPages] }) }), _jsx(PaginationItem, { children: _jsx(PaginationNext, { href: hrefFor(page + 1), "aria-disabled": page >= totalPages, className: cn(page >= totalPages && "pointer-events-none opacity-50"), onClick: (event) => {
                            event.preventDefault();
                            if (page < totalPages)
                                onPageChange(page + 1);
                        } }) })] }) }));
}
/** The bar pinned to the bottom of a list screen: a summary on the left, controls on the right. */
export function ListFooter({ children, className }) {
    return (_jsx("div", { className: cn("flex h-12 shrink-0 items-center justify-between gap-3 border-t px-5 text-monti-muted-foreground text-xs", className), children: children }));
}
/**
 * The footer of every paged list (entries, trash, media, events): the shown range on the left; on the right optional extra controls,
 * the page size and the pager.
 */
export function ListPagination({ total, shown, page, pageSize, onPageChange, onPageSizeChange, hrefFor, leading, }) {
    const t = useTranslator(screensMessages);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return (_jsxs(ListFooter, { children: [_jsx("span", { className: "tabular", children: t("list.range", {
                    total,
                    range: shown > 0 ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}` : "0",
                }) }), _jsxs("div", { className: "flex items-center gap-2", children: [leading, _jsxs(Select, { value: String(pageSize), items: PAGE_SIZES.map((size) => ({ value: String(size), label: t("list.pageSizeOption", { size }) })), onValueChange: (value) => value && onPageSizeChange(Number(value)), children: [_jsx(SelectTrigger, { size: "sm", "aria-label": t("list.pageSize"), className: "h-7 border-0 text-xs shadow-none", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: PAGE_SIZES.map((size) => (_jsx(SelectItem, { value: String(size), children: t("list.pageSizeOption", { size }) }, size))) })] }), _jsx(ListPager, { page: page, totalPages: totalPages, onPageChange: onPageChange, hrefFor: hrefFor })] })] }));
}
