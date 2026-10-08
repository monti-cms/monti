import { type Site } from "@monti-cms/core/client";
import { type ListState } from "./list-state.js";
import type { TaxonomyOptions } from "./shared/use-taxonomy.js";
export interface FilterChip {
    key: string;
    label: string;
    clear: Partial<ListState>;
}
/**
 * Applied filter chips. Even when a column is hidden, filters on it keep showing as chips
 * to prevent "why can't I see my posts?".
 */
export declare function filterChips(site: Site, state: ListState, options: TaxonomyOptions): FilterChip[];
/** Search box in the header. Sends a server search when typing pauses. Document collections can turn on body search. */
export declare function ListSearch({ state, onChange, allowBody, }: {
    state: ListState;
    onChange: (patch: Partial<ListState>) => void;
    allowBody?: boolean;
}): import("react").JSX.Element;
/** Row of applied filter chips. Not drawn when there are no filters. */
export declare function FilterChipBar({ state, options, onChange, }: {
    state: ListState;
    options: TaxonomyOptions;
    onChange: (patch: Partial<ListState>) => void;
}): import("react").JSX.Element | null;
