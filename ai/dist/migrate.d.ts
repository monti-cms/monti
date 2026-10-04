import type { PluginDatabase } from "@monti-cms/core";
/**
 * AI plugin tables. `monti migrate` calls this after the core tables. Safe to call repeatedly.
 * Stores from before (when AI lived in the core) share the table names and migration markers, so they keep working as they are.
 */
export declare function migrateAi({ pool, schema, once }: PluginDatabase): Promise<void>;
