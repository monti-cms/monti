import type { Entry } from "../../../core/store/types.js";
import type { PreparedSnapshot } from "../../../core/types.js";
import { type StoreContext } from "./context.js";
import type { Publishing } from "./publish.js";
type LifecycleParams = {
    id: string;
    expectedVersion: number;
};
/**
 * Status transitions. Which statuses a transition starts from, and what it does to the translations, is decided by `core/domain/lifecycle`;
 * this module locks the rows, applies the result and keeps the version bumps.
 */
export declare function createLifecycleOps(ctx: StoreContext, publishing: Publishing): {
    /** Draft/published to archived. Ends publication. Record collections have no archive. */
    archiveEntry: (params: LifecycleParams) => Promise<Entry>;
    /** Archived to draft. Does not republish automatically. */
    unarchiveEntry: (params: LifecycleParams) => Promise<Entry>;
    /**
     * To trash. Ends publication.
     * A category item in use (record collections: tags, categories, etc.) must have its references released first.
     */
    trashEntry: (params: LifecycleParams) => Promise<Entry>;
    /**
     * Trash to restore. Publish collections return to draft; record collections are validated for current values and relations
     * and then returned to active (published) records.
     */
    restoreEntry: (params: LifecycleParams & {
        snapshot?: PreparedSnapshot;
    }) => Promise<Entry>;
    /**
     * Permanently deletes a trashed entry. Rejected if other content references it.
     * Slugs that were ever published keep only a reuse-prevention record (`deleted`); reserved slugs that were never published are released.
     */
    permanentDeleteEntry: (params: LifecycleParams) => Promise<void>;
};
export {};
