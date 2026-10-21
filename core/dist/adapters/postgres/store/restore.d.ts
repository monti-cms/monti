import type { RestorePlan, RestoreResult, SiteContentCounts } from "../../../core/store/types.js";
import { type StoreContext } from "./context.js";
/**
 * Restoring a backup into an empty site. Everything is written in one transaction: the tables that hold the content, and the ones derived from it
 * (the search text of each body, the reference index, the addresses). Nothing is recorded in the event outbox, so no subscriber hears of it.
 */
export declare function createRestoreOps(ctx: StoreContext): {
    countSiteContent: () => Promise<SiteContentCounts>;
    restoreArchive: (plan: RestorePlan) => Promise<RestoreResult>;
};
