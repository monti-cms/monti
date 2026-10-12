import type { PoolClient } from "pg";
import type { LegacyBodies } from "../../../format/types.js";
import type { UnreadableBody } from "../../../server/define.js";
import type { Site } from "../../../site/index.js";
export interface ReconvertOptions {
    readonly site: Site;
    /** Reads the MDX text with the format and syntax extensions of the config as they are now (supplied by the `mdx` format). */
    readonly bodies: LegacyBodies;
    readonly batchSize?: number;
    /** Called for each body that still cannot be read. */
    readonly onUnreadable?: (body: UnreadableBody) => void;
}
/**
 * Reads the bodies and templates that are kept as an `unparsed` document again, with the format and syntax extensions of the config as they are now. It is for the
 * bodies a migration kept as source because the site could not read them then: after the config changed (for example the directive syntax was turned on) they read.
 * A body that reads now gets its document (soft line endings made explicit as step `0012` does, block ids kept), `content_hash` and `search_text`; one that still does not
 * stays as it is. `version`, `updated_at` and the entry are not touched, and running it again changes only what has become readable since.
 * Rows are read in key order, `batchSize` at a time. Runs inside the caller's transaction; links by id are resolved afterwards by `migrateLinkEntryIds`.
 */
export declare function reconvertUnparsedBodies(client: PoolClient, qSchema: string, options: ReconvertOptions): Promise<{
    readonly converted: number;
    readonly remaining: number;
}>;
