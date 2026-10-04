import type { StoreContext } from "./context.js";
import type { ListEntriesParams, ListEntriesResult } from "./types.js";
/** Admin list. Search, filtering, sorting, and paging are handled on the server. */
export declare function createListOps(ctx: StoreContext): {
    listEntries: (params: ListEntriesParams) => Promise<ListEntriesResult>;
};
