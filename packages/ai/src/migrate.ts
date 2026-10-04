import type { PluginDatabase } from "@monti-cms/core";
import { legacyFeatureOverride } from "./actions";

/**
 * AI plugin tables. `monti migrate` calls this after the core tables. Safe to call repeatedly.
 * Stores from before (when AI lived in the core) share the table names and migration markers, so they keep working as they are.
 */
export async function migrateAi({ pool, schema, once }: PluginDatabase): Promise<void> {
	const qSchema = schema;
	await pool.query(`
		-- Edited values of AI actions. Definitions live in the site config; only values edited in the admin are stored per action name.
		CREATE TABLE IF NOT EXISTS "${qSchema}".ai_action_overrides (
			key TEXT PRIMARY KEY,
			value JSONB NOT NULL,
			version INTEGER NOT NULL DEFAULT 1,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		-- Actions made in the admin AI screen. The value holds the basic info and the edited values.
		CREATE TABLE IF NOT EXISTS "${qSchema}".ai_custom_actions (
			key TEXT PRIMARY KEY,
			value JSONB NOT NULL,
			version INTEGER NOT NULL DEFAULT 1,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		-- AI service connections (address, encrypted key, model). One row (id = 'default'). Edited shared texts are the 'shared' row.
		CREATE TABLE IF NOT EXISTS "${qSchema}".ai_settings (
			id TEXT PRIMARY KEY,
			value JSONB NOT NULL,
			version INTEGER NOT NULL DEFAULT 1,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
	`);

	// If the old AI actions table (`ai_features`) has edited values, move them once into per-action edited values. The old table is not dropped.
	// The name matches the old records (there are records written before the plugin name was attached).
	await once("migrate_ai_features_to_actions", async (client) => {
		const legacy = await client.query<{ exists: string | null }>(`SELECT to_regclass($1)::text AS exists`, [
			`"${qSchema}".ai_features`,
		]);
		if (!legacy.rows[0]?.exists) return;
		const rows = await client.query<{ builtin: string | null; spec: unknown }>(
			`SELECT builtin, spec FROM "${qSchema}".ai_features WHERE builtin IS NOT NULL`,
		);
		for (const row of rows.rows) {
			const value = row.builtin ? legacyFeatureOverride(row.builtin, row.spec) : null;
			if (!value || Object.keys(value).length === 0) continue;
			await client.query(
				`INSERT INTO "${qSchema}".ai_action_overrides (key, value, version, updated_at) VALUES ($1, $2, 1, NOW())
				 ON CONFLICT (key) DO NOTHING`,
				[row.builtin, JSON.stringify(value)],
			);
		}
	});
}
