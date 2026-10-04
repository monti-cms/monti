import type { Pool } from "pg";
/**
 * Core content lookup for plugins (read-only). Plugins do not read core tables directly; they ask through this function.
 * Exported from `@monti-cms/core/plugin/server`.
 *
 * ```ts
 * const lookup = createContentLookup(getCmsDatabase());
 * await lookup.slugsInUse({ collection: "post", locale: "ko", slugs: ["hello"], excludeEntryId: id });
 * ```
 */
export interface SlugsInUseParams {
    readonly collection: string;
    readonly locale: string;
    /** Slugs to check. An empty array skips the query. */
    readonly slugs: readonly string[];
    /** Ignore slugs used by this entry (the entry being edited). */
    readonly excludeEntryId?: string;
}
export interface ContentLookup {
    /**
     * Slugs that are already used in the same collection and language (current, reserved, former, and deleted-entry slugs). These are the
     * same slugs that cause a slug conflict (`slug_conflict`) on save.
     */
    slugsInUse(params: SlugsInUseParams): Promise<Set<string>>;
}
export declare function createContentLookup({ pool, schema }: {
    readonly pool: Pool;
    readonly schema: string;
}): ContentLookup;
