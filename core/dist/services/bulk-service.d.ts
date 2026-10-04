import type { Issue, StorePort } from "./types.js";
export declare const BULK_OPS: readonly ["relation.add", "relation.remove", "relation.set", "folder.move", "archive", "unarchive", "trash", "publish", "permanentDelete"];
export type BulkOp = (typeof BULK_OPS)[number];
export type BulkItem = {
    readonly id: string;
    readonly expectedVersion: number;
};
export type BulkRequest = {
    readonly op: BulkOp;
    readonly items: readonly BulkItem[];
    /** Name of the relation field that `relation.*` changes. */
    readonly field?: string;
    /** `relation.add` and `relation.remove`: IDs to add to or remove from a multi-value relation field. */
    readonly ids?: readonly string[];
    /** `relation.set`: new value of a single-value relation field. Cleared if `null`. */
    readonly id?: string | null;
    readonly folderId?: string | null;
};
/** References (usages) that blocked permanent deletion. The trash screen shows them as a reason (e.g. "in use: X"). */
export type BulkUsage = {
    readonly entryId: string;
    readonly title: string | null;
    readonly collection: string;
    readonly state: string;
};
export type BulkItemResult = {
    readonly id: string;
    readonly ok: true;
    readonly version: number;
} | {
    readonly id: string;
    readonly ok: false;
    readonly error: string;
    readonly issues?: readonly Issue[];
    readonly usages?: readonly BulkUsage[];
};
/** Contract a bulk operation requires from the store. Permanent deletion is used only in bulk operations, so it is not put in the shared `StorePort`. */
export interface BulkStorePort<T = unknown> extends StorePort<T> {
    /** Permanently deletes only trash items. Rejects with `in_use` (details.usages) if other content references it. */
    permanentDeleteEntry(params: {
        id: string;
        expectedVersion: number;
    }): Promise<void>;
}
export declare const createBulkService: <T = unknown>(storePort: BulkStorePort<T>) => {
    run: (request: BulkRequest) => Promise<{
        results: BulkItemResult[];
    }>;
};
