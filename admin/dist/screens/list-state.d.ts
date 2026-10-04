import { type Collection, type ListSortField, type Locale, type PageSize } from "@monti-cms/core/client";
import type { EntryStatus } from "./shared/entry-status.js";
/** Statuses that can be filtered in the list. Trash is seen only in its dedicated screen. */
export type ListStatus = Exclude<EntryStatus, "trashed">;
export declare const LIST_STATUSES: readonly ListStatus[];
/**
 * Admin list state. Reflects folder, search, filters, sort and page in the URL so Back restores it.
 * Page size, sort defaults and columns are saved in per-collection user settings.
 */
export interface ListState {
    collection: Collection;
    /**
     * `all` is the top level (root of the folders); anything else is a folder ID. In browse mode the top level shows only top-level folders and items outside folders.
     * `unfiled` in old addresses is read as the top level.
     */
    folder: string;
    includeDescendants: boolean;
    search: string;
    includeBody: boolean;
    /** Column header filter: partial match on title only / slug only. */
    titleContains: string;
    slugContains: string;
    /** Empty means everything except trash. Multiple values are OR. */
    statuses: ListStatus[];
    hasChanges: boolean;
    /** Taxonomy field name -> chosen item IDs. Multiple values of the same field are OR; different fields are AND. */
    relations: Readonly<Record<string, readonly string[]>>;
    /** Content locale. Empty means all locales. */
    locales: Locale[];
    /** `YYYY-MM-DD` (date in the configured time zone). */
    createdFrom: string;
    createdTo: string;
    updatedFrom: string;
    updatedTo: string;
    publishedFrom: string;
    publishedTo: string;
    sortField: ListSortField;
    sortDirection: "asc" | "desc";
    page: number;
    pageSize: PageSize;
}
export declare const DEFAULT_LIST_STATE: Omit<ListState, "collection">;
export declare const DATE_KEYS: readonly ["createdFrom", "createdTo", "updatedFrom", "updatedTo", "publishedFrom", "publishedTo"];
export declare function parseListState(params: URLSearchParams): ListState & {
    explicit: {
        pageSize: boolean;
        sort: boolean;
    };
};
/** Values equal to the defaults are not written to the URL. */
export declare function listStateToSearchParams(state: ListState): URLSearchParams;
/**
 * List API (`GET /entries`) query. Multiple values of the same filter are OR; different filters are AND.
 * With `trash`, requests only trashed items.
 * Publishable collections (posts, memos) are requested one row per translation group. Trash lists items individually so a single translation can be restored.
 */
export declare function listStateToApiQuery(state: ListState, options?: {
    trash?: boolean;
}): URLSearchParams;
/** Number of header filters, excluding search. */
export declare const activeFilterCount: (state: ListState) => number;
/**
 * Folder browse mode: with no search or filter and "include subfolders" off, shows only the subfolders and directly contained items of the current location, like a file explorer.
 * Otherwise shows all items under the current location flat, without folder separation.
 */
export declare function isExplorerMode(state: ListState): boolean;
/** State with all search and filters cleared (sort, folder and page size kept). */
export declare function clearFilters(state: ListState): ListState;
