import type { PluginDatabase } from "@monti-cms/core";
import { legacyFeatureOverride } from "./actions";

/**
 * AI 플러그인 표. `monti migrate`가 본체 표 다음에 부른다. 여러 번 불러도 결과가 같다.
 * 예전(본체에 AI가 있던 때) 저장소도 표 이름과 이전 표시가 같아 그대로 이어 쓴다.
 */
export async function migrateAi({ pool, schema, once }: PluginDatabase): Promise<void> {
	const qSchema = schema;
	await pool.query(`
		-- Edited values of AI actions (M2). Definitions live in the site config; only values edited in the admin are stored per action name.
		CREATE TABLE IF NOT EXISTS "${qSchema}".ai_action_overrides (
			key TEXT PRIMARY KEY,
			value JSONB NOT NULL,
			version INTEGER NOT NULL DEFAULT 1,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		-- Actions made in the admin AI screen (M8-5). The value holds the basic info and the edited values.
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

	// 예전 AI 기능 표(`ai_features`)에 고친 값이 있으면 한 번만 기능 이름별 고친 값으로 옮긴다. 예전 표는 지우지 않는다.
	// 이름은 예전 기록과 같다(플러그인 이름을 붙이기 전에 남긴 기록이 있다).
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
