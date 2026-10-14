import type { BulkOp } from "@monti-cms/core/client";
import type { EntriesPage } from "../../api/entries.js";
import type { ListState } from "../list-state.js";
export type OptimisticOp = BulkOp | "restore";
export interface OptimisticContext {
    state: Pick<ListState, "statuses" | "folder" | "includeDescendants">;
    params?: {
        field?: string;
        ids?: string[];
        id?: string | null;
        folderId?: string | null;
    };
    /** Relation field name -> selectable items. Used to preview the name of a newly added item. */
    options?: Readonly<Record<string, readonly {
        id: string;
        title: string;
    }[]>>;
}
/**
 * Reflects the action result into the list before the server responds (optimistic update). Applies only changes known for certain,
 * and leaves the rest (e.g. state after unarchiving) to the refetch that follows soon. Rows that drop out of the current filter are removed right away.
 */
export declare function applyOptimistic(page: EntriesPage, op: OptimisticOp, ids: ReadonlySet<string>, context: OptimisticContext): EntriesPage;
