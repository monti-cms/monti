import { type BulkOp } from "@monti-cms/core/site";
import { type BulkItemResult, type BulkParams, type BulkSelection, entriesKeys } from "../api/entries.js";
import type { ListState } from "./list-state.js";
import { type OptimisticOp } from "./shared/list-cache.js";
import type { TaxonomyOptions } from "./shared/use-taxonomy.js";
/**
 * An action that changes the list. Applies the change to the list first, then sends the request. If the request itself fails it is rolled back,
 * and when it ends the list is synced to server values. Per-item results go to `onResults` (used to keep failed items selected).
 */
export declare function useEntryMutations({ listKey, state, options, onResults, }: {
    listKey: ReturnType<typeof entriesKeys.list>;
    state: ListState;
    options: TaxonomyOptions;
    onResults: (results: BulkItemResult[]) => void;
}): {
    run: (op: OptimisticOp, targets: BulkSelection[], params?: BulkParams) => Promise<BulkItemResult[]>;
    bulk: (op: BulkOp, label: string, targets: BulkSelection[], params?: BulkParams) => Promise<void>;
    restore: (targets: BulkSelection[]) => Promise<void>;
    invalidateEntries: () => Promise<void>;
};
