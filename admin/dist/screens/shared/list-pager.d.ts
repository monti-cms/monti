import { type PageSize } from "@monti-cms/core/client";
/** Previous / page of pages / next, as used at the bottom of every paged list. */
export declare function ListPager({ page, totalPages, onPageChange, hrefFor, }: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    /** Address of a page, so the controls are real links. Without it they are buttons. */
    hrefFor?: (page: number) => string;
}): import("react").JSX.Element;
/** The bar pinned to the bottom of a list screen: a summary on the left, controls on the right. */
export declare function ListFooter({ children, className }: {
    children: React.ReactNode;
    className?: string;
}): import("react").JSX.Element;
/**
 * The footer of every paged list (entries, trash, media, events): the shown range on the left; on the right optional extra controls,
 * the page size and the pager.
 */
export declare function ListPagination({ total, shown, page, pageSize, onPageChange, onPageSizeChange, hrefFor, leading, }: {
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
}): import("react").JSX.Element;
