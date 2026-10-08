import { type EntrySearchHit, type ListEntriesParams, type ListEntriesResult, type SearchEntriesParams } from "../../../core/store/types.js";
import type { StoreContext } from "./context.js";
/** Admin list. Search, filtering, sorting, and paging are handled on the server. */
export declare function createListOps(ctx: StoreContext): {
    searchEntries: (params: SearchEntriesParams) => Promise<EntrySearchHit[]>;
    listEntries: (params: ListEntriesParams) => Promise<ListEntriesResult>;
};
