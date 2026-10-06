import type { PluginDatabase } from "@monti-cms/core";
import { type Cms, CmsError, withTransaction } from "@monti-cms/core/plugin/server";

/** Row name in the AI settings table (`ai_settings`). */
export type AiSettingsId = "default" | "shared";

/** One row of edited values per action name. */
export interface AiActionOverrideRow {
	key: string;
	/** Edited values that differ from the definition (shape of `aiActionOverrideSchema`). */
	value: unknown;
	version: number;
	updatedAt: Date;
}

/** Edited AI action values (`ai_action_overrides`), connection settings (`ai_settings`) and UI actions (`ai_custom_actions`). */
export function createAiStore(
	{ pool, schema: qSchema }: PluginDatabase,
	/** `secret`: the encryption key for stored service keys (`cms.secret`). */
	options: { readonly secret?: () => string | undefined } = {},
) {
	return {
		secret: (): string | undefined => options.secret?.(),
		/** All edited values. Actions never edited have none. */
		listAiActionOverrides: async (): Promise<AiActionOverrideRow[]> => {
			const res = await pool.query<{ key: string; value: unknown; version: number; updated_at: Date }>(
				`SELECT key, value, version, updated_at FROM "${qSchema}".ai_action_overrides ORDER BY key`,
			);
			return res.rows.map((row) => ({
				key: row.key,
				value: row.value,
				version: row.version,
				updatedAt: row.updated_at,
			}));
		},

		/**
		 * Changes the edited values. The first time, `expectedVersion` is 0; after that, a different version gives 409.
		 * If the edited values become empty (all defaults), the row is kept so the version carries on.
		 */
		saveAiActionOverride: async (params: {
			key: string;
			expectedVersion: number;
			value: unknown;
		}): Promise<AiActionOverrideRow> =>
			withTransaction(pool, async (client) => {
				const cur = await client.query<{ version: number }>(
					`SELECT version FROM "${qSchema}".ai_action_overrides WHERE key = $1 FOR UPDATE`,
					[params.key],
				);
				const version = cur.rows[0]?.version ?? 0;
				if (version !== params.expectedVersion) throw new CmsError("Conflict", "conflict", version);
				const res = await client.query<{ key: string; value: unknown; version: number; updated_at: Date }>(
					`INSERT INTO "${qSchema}".ai_action_overrides (key, value, version, updated_at) VALUES ($1, $2, $3, NOW())
					 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, version = EXCLUDED.version, updated_at = NOW()
					 RETURNING key, value, version, updated_at`,
					[params.key, JSON.stringify(params.value), version + 1],
				);
				const row = res.rows[0] as { key: string; value: unknown; version: number; updated_at: Date };
				return { key: row.key, value: row.value, version: row.version, updatedAt: row.updated_at };
			}),

		/**
		 * One AI settings row (as stored). `default` is the service connection and `shared` is the edited shared text. `null` if none.
		 */
		getAiSettings: async (id: AiSettingsId = "default"): Promise<{ value: unknown; version: number } | null> => {
			const res = await pool.query<{ value: unknown; version: number }>(
				`SELECT value, version FROM "${qSchema}".ai_settings WHERE id = $1`,
				[id],
			);
			return res.rows[0] ?? null;
		},

		/** Saves one settings row. The first time, `expectedVersion` is 0; after that, a different version gives 409. */
		saveAiSettings: async (params: { id?: AiSettingsId; expectedVersion: number; value: unknown }): Promise<number> =>
			withTransaction(pool, async (client) => {
				const id = params.id ?? "default";
				const cur = await client.query<{ version: number }>(
					`SELECT version FROM "${qSchema}".ai_settings WHERE id = $1 FOR UPDATE`,
					[id],
				);
				const version = cur.rows[0]?.version ?? 0;
				if (version !== params.expectedVersion) throw new CmsError("Conflict", "conflict", version);
				await client.query(
					`INSERT INTO "${qSchema}".ai_settings (id, value, version, updated_at) VALUES ($1, $2, $3, NOW())
					 ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, version = EXCLUDED.version, updated_at = NOW()`,
					[id, JSON.stringify(params.value), version + 1],
				);
				return version + 1;
			}),

		/** All UI actions (actions created in the admin screen). In creation order. */
		listAiCustomActions: async (): Promise<AiActionOverrideRow[]> => {
			const res = await pool.query<{ key: string; value: unknown; version: number; updated_at: Date }>(
				`SELECT key, value, version, updated_at FROM "${qSchema}".ai_custom_actions ORDER BY created_at, key`,
			);
			return res.rows.map((row) => ({
				key: row.key,
				value: row.value,
				version: row.version,
				updatedAt: row.updated_at,
			}));
		},

		/** Creates (`expectedVersion` 0) or edits a UI action. A different version gives 409. */
		saveAiCustomAction: async (params: {
			key: string;
			expectedVersion: number;
			value: unknown;
		}): Promise<AiActionOverrideRow> =>
			withTransaction(pool, async (client) => {
				const cur = await client.query<{ version: number }>(
					`SELECT version FROM "${qSchema}".ai_custom_actions WHERE key = $1 FOR UPDATE`,
					[params.key],
				);
				const version = cur.rows[0]?.version ?? 0;
				if (version !== params.expectedVersion) throw new CmsError("Conflict", "conflict", version);
				const res = await client.query<{ updated_at: Date }>(
					`INSERT INTO "${qSchema}".ai_custom_actions (key, value, version, created_at, updated_at)
					 VALUES ($1, $2, $3, NOW(), NOW())
					 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, version = EXCLUDED.version, updated_at = NOW()
					 RETURNING updated_at`,
					[params.key, JSON.stringify(params.value), version + 1],
				);
				return {
					key: params.key,
					value: params.value,
					version: version + 1,
					updatedAt: res.rows[0]?.updated_at ?? new Date(),
				};
			}),

		/** Deletes a UI action. A different version gives 409; if it does not exist, 404. */
		deleteAiCustomAction: async (params: { key: string; expectedVersion: number }): Promise<void> =>
			withTransaction(pool, async (client) => {
				const cur = await client.query<{ version: number }>(
					`SELECT version FROM "${qSchema}".ai_custom_actions WHERE key = $1 FOR UPDATE`,
					[params.key],
				);
				const version = cur.rows[0]?.version;
				if (version === undefined) throw new CmsError("Not found", "not_found");
				if (version !== params.expectedVersion) throw new CmsError("Conflict", "conflict", version);
				await client.query(`DELETE FROM "${qSchema}".ai_custom_actions WHERE key = $1`, [params.key]);
			}),
	};
}

export type AiStore = ReturnType<typeof createAiStore>;

const stores = new WeakMap<Cms, AiStore>();

/** The AI store of one CMS instance, built from its main DB connection on first use. Each instance has its own. */
export function aiStoreFor(cms: Cms): AiStore {
	let store = stores.get(cms);
	if (!store) {
		store = createAiStore(cms.database(), { secret: () => cms.secret });
		stores.set(cms, store);
	}
	return store;
}
