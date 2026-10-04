import type { PoolClient } from "pg";
import { type Reference } from "../../../core/types.js";
import type { StoreContext } from "./context.js";
import type { Entry } from "./types.js";
export interface PublishOptions {
    expectedVersion: number;
    /** On re-publish, reset the publish date to now. Otherwise keep the first publish time. */
    resetPublishedAt?: boolean;
}
/**
 * Shared rules for publish transactions. Publishing and record restore use the same validation.
 */
export declare function createPublishing(ctx: StoreContext): {
    validateStoredWorkingForPublish: (client: PoolClient, entryId: string) => Promise<import("../../../client.js").PreparedSnapshot>;
    publishWithinTransaction: (client: PoolClient, id: string, options: PublishOptions) => Promise<Entry>;
    lockDraftReferenceTargets: (client: PoolClient, references: readonly Reference[]) => Promise<void>;
    assertNotReferenced: (client: PoolClient, id: string, options: {
        ignoreTrashedSources: boolean;
    }) => Promise<void>;
};
export type Publishing = ReturnType<typeof createPublishing>;
