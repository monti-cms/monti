import type { PoolClient } from "pg";
import type { Entry } from "../../../core/store/types.js";
import { type Issue, type PreparedSnapshot, type Reference } from "../../../core/types.js";
import type { StoreContext } from "./context.js";
export interface PublishOptions {
    expectedVersion: number;
    /**
     * The prepared snapshot of the draft being published. The service builds it (hooks, normalization, reference collection) before the
     * transaction; the store only checks it against rows it has to lock (reference targets, media, link addresses) and never prepares content itself.
     */
    snapshot: PreparedSnapshot;
    /** On re-publish, reset the publish date to now. Otherwise keep the first publish time. */
    resetPublishedAt?: boolean;
    /** Sets the publish date to this time (a re-publish with no change included). The import of content that was published elsewhere first uses it. */
    publishedAt?: Date;
    /**
     * Called with the notices the checks against locked rows found (a link to an entry that is not published): they never block, and the caller
     * returns them with the publish result.
     */
    onWarnings?: (warnings: readonly Issue[]) => void;
}
/** The transaction's `client` is what the hook (`beforePublishCommit`) receives; the queries run on the Kysely handle of the same client (`ctx.db(client)`). */
export declare function createPublishing(ctx: StoreContext): {
    validatePreparedForPublish: (client: PoolClient, entryId: string, snapshot: PreparedSnapshot) => Promise<{
        snapshot: PreparedSnapshot;
        warnings: Issue[];
    }>;
    publishWithinTransaction: (client: PoolClient, id: string, options: PublishOptions) => Promise<Entry>;
    lockDraftReferenceTargets: (client: PoolClient, references: readonly Reference[]) => Promise<readonly Reference[]>;
    assertNotReferenced: (client: PoolClient, id: string, options: {
        ignoreTrashedSources: boolean;
    }) => Promise<void>;
};
export type Publishing = ReturnType<typeof createPublishing>;
