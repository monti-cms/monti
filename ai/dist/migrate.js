import { legacyFeatureOverride } from "./actions.js";
import { AI_COLLECTIONS } from "./collections.js";
import { aiSecrets } from "./secret.js";
import { upgradeStoredKeys } from "./settings.js";
import { createAiStore } from "./store.js";
/**
 * Tables the AI plugin kept in the database itself, before it used the plugin storage API (`cms.storage("ai")`), and where their rows go now.
 * Their names stay the collection names, so an old row `key` or `id` is the new item key.
 */
const LEGACY_TABLES = [
    { table: "ai_action_overrides", collection: AI_COLLECTIONS.actionOverrides, keyColumn: "key" },
    { table: "ai_custom_actions", collection: AI_COLLECTIONS.customActions, keyColumn: "key" },
    { table: "ai_settings", collection: AI_COLLECTIONS.settings, keyColumn: "id" },
];
const asDate = (value) => (value instanceof Date ? value : undefined);
/** Copies the rows of the three legacy tables into the storage, keeping each row's value, version and dates. A table that does not exist has nothing to copy. */
async function importLegacyTables(migration) {
    for (const { table, collection, keyColumn } of LEGACY_TABLES) {
        for (const row of (await migration.readLegacyTable(table)) ?? []) {
            const key = row[keyColumn];
            if (typeof key !== "string")
                continue;
            const updatedAt = asDate(row.updated_at);
            await migration.importItem(collection, {
                key,
                value: row.value,
                version: typeof row.version === "number" ? row.version : 1,
                createdAt: asDate(row.created_at) ?? updatedAt,
                updatedAt,
            });
        }
    }
}
/**
 * Moves the edited values of the oldest AI actions table (`ai_features`, from when AI lived in the core) into per-action edited values, once.
 * The old table is not dropped. An edited value that is already in the storage is kept.
 */
async function importLegacyFeatures(migration, site) {
    const overrides = await migration.readLegacyTable("ai_features");
    for (const row of overrides ?? []) {
        const builtin = row.builtin;
        if (typeof builtin !== "string")
            continue;
        const value = legacyFeatureOverride(site, builtin, row.spec);
        if (!value || Object.keys(value).length === 0)
            continue;
        await migration.importItem(AI_COLLECTIONS.actionOverrides, { key: builtin, value });
    }
}
/**
 * AI plugin migration. `monti migrate` calls it after the core tables, with the plugin's storage. Safe to call repeatedly.
 *
 * Data from before the storage API is moved once: the three tables the plugin used to create itself (`ai_action_overrides`, `ai_custom_actions`, `ai_settings`)
 * are copied into the plugin's collections with their versions and dates, and the old tables stay where they are, untouched.
 */
export async function migrateAi(storage, cms) {
    await storage.once("import_legacy_tables", importLegacyTables);
    // The name of this step before the storage API was `migrate_ai_features_to_actions` (recorded without the plugin's name). Where that record exists, the work is done.
    await storage.once("ai_features_to_actions", (migration) => importLegacyFeatures(migration, cms.site), {
        legacyNames: ["migrate_ai_features_to_actions"],
    });
    // Stored service keys from before per-plugin keys (or made with a previous secret) are encrypted again with the current secret.
    // It does nothing when there is no secret or nothing to upgrade, so running it again changes nothing.
    await upgradeStoredKeys(cms.site, createAiStore(storage, { site: cms.site, secrets: () => aiSecrets(cms) }));
}
