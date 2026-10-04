import { type StoreContext } from "./context.js";
import type { Publishing } from "./publish.js";
import type { Entry } from "./types.js";
type LifecycleParams = {
    id: string;
    expectedVersion: number;
};
/**
 * Status transitions. A disallowed source status is rejected with `invalid_status` (409),
 * for example so that pressing `보관 해제` or `복원` on a published entry cannot silently take it offline.
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
    restoreEntry: (params: LifecycleParams) => Promise<Entry>;
    /**
     * Permanently deletes a trashed entry. Rejected if other content references it.
     * Slugs that were ever published keep only a reuse-prevention record (`deleted`); reserved slugs that were never published are released.
     */
    permanentDeleteEntry: (params: LifecycleParams) => Promise<void>;
};
export {};
