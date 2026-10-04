import { type AdminListColumn, type ColumnFilter } from "./list-columns.js";
import { type ListState } from "./list-state.js";
import type { TaxonomyOptions } from "./shared/use-taxonomy.js";
/** `relations` with one taxonomy filter changed. An empty list is removed. */
export declare function setRelation(state: ListState, field: string, ids: readonly string[]): Partial<ListState>;
/** Change that clears this filter. Used by the chip's `✕` and the popup's `필터 해제`. */
export declare function clearPatchFor(filter: ColumnFilter, state: ListState): Partial<ListState>;
/**
 * Sort/filter popup opened from the column header, like Excel. A header with a filter changes its icon shape
 * so state is not conveyed by color alone. Sortable columns put `aria-sort` on the header cell (done by the caller).
 */
export declare function ColumnHeader({ column, filter, state, options, onChange, }: {
    column: AdminListColumn;
    filter: ColumnFilter;
    state: ListState;
    options: TaxonomyOptions;
    onChange: (patch: Partial<ListState>) => void;
}): import("react").JSX.Element;
