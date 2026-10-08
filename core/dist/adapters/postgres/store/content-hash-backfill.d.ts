import type { PoolClient } from "pg";
import type { LegacyBodies } from "../../../format/types.js";
/**
 * Recomputes `content_hash` of every stored body (working and published) with the current hash rule (`computeContentHash`, over the document of the row's MDX).
 * Only the hash column changes: the body, its dates and the entry version stay as they are.
 * Rows are read in key order, `batchSize` at a time, so memory stays flat on a large store. Runs inside the caller's transaction.
 */
export declare function recomputeContentHashes(client: PoolClient, qSchema: string, options: {
    batchSize?: number;
    bodies: LegacyBodies;
}): Promise<void>;
