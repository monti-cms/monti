import { CmsError, getCmsDatabase, withTransaction } from "@monti-cms/core/plugin/server";
/** Edited AI action values (`ai_action_overrides`), connection settings (`ai_settings`) and UI actions (`ai_custom_actions`). */
export function createAiStore({ pool, schema: qSchema }) {
    return {
        /** All edited values. Actions never edited have none. */
        listAiActionOverrides: async () => {
            const res = await pool.query(`SELECT key, value, version, updated_at FROM "${qSchema}".ai_action_overrides ORDER BY key`);
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
        saveAiActionOverride: async (params) => withTransaction(pool, async (client) => {
            const cur = await client.query(`SELECT version FROM "${qSchema}".ai_action_overrides WHERE key = $1 FOR UPDATE`, [params.key]);
            const version = cur.rows[0]?.version ?? 0;
            if (version !== params.expectedVersion)
                throw new CmsError("Conflict", "conflict", version);
            const res = await client.query(`INSERT INTO "${qSchema}".ai_action_overrides (key, value, version, updated_at) VALUES ($1, $2, $3, NOW())
					 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, version = EXCLUDED.version, updated_at = NOW()
					 RETURNING key, value, version, updated_at`, [params.key, JSON.stringify(params.value), version + 1]);
            const row = res.rows[0];
            return { key: row.key, value: row.value, version: row.version, updatedAt: row.updated_at };
        }),
        /**
         * One AI settings row (as stored). `default` is the service connection and `shared` is the edited shared text. `null` if none.
         */
        getAiSettings: async (id = "default") => {
            const res = await pool.query(`SELECT value, version FROM "${qSchema}".ai_settings WHERE id = $1`, [id]);
            return res.rows[0] ?? null;
        },
        /** Saves one settings row. The first time, `expectedVersion` is 0; after that, a different version gives 409. */
        saveAiSettings: async (params) => withTransaction(pool, async (client) => {
            const id = params.id ?? "default";
            const cur = await client.query(`SELECT version FROM "${qSchema}".ai_settings WHERE id = $1 FOR UPDATE`, [id]);
            const version = cur.rows[0]?.version ?? 0;
            if (version !== params.expectedVersion)
                throw new CmsError("Conflict", "conflict", version);
            await client.query(`INSERT INTO "${qSchema}".ai_settings (id, value, version, updated_at) VALUES ($1, $2, $3, NOW())
					 ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, version = EXCLUDED.version, updated_at = NOW()`, [id, JSON.stringify(params.value), version + 1]);
            return version + 1;
        }),
        /** All UI actions (actions created in the admin screen). In creation order. */
        listAiCustomActions: async () => {
            const res = await pool.query(`SELECT key, value, version, updated_at FROM "${qSchema}".ai_custom_actions ORDER BY created_at, key`);
            return res.rows.map((row) => ({
                key: row.key,
                value: row.value,
                version: row.version,
                updatedAt: row.updated_at,
            }));
        },
        /** Creates (`expectedVersion` 0) or edits a UI action. A different version gives 409. */
        saveAiCustomAction: async (params) => withTransaction(pool, async (client) => {
            const cur = await client.query(`SELECT version FROM "${qSchema}".ai_custom_actions WHERE key = $1 FOR UPDATE`, [params.key]);
            const version = cur.rows[0]?.version ?? 0;
            if (version !== params.expectedVersion)
                throw new CmsError("Conflict", "conflict", version);
            const res = await client.query(`INSERT INTO "${qSchema}".ai_custom_actions (key, value, version, created_at, updated_at)
					 VALUES ($1, $2, $3, NOW(), NOW())
					 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, version = EXCLUDED.version, updated_at = NOW()
					 RETURNING updated_at`, [params.key, JSON.stringify(params.value), version + 1]);
            return {
                key: params.key,
                value: params.value,
                version: version + 1,
                updatedAt: res.rows[0]?.updated_at ?? new Date(),
            };
        }),
        /** Deletes a UI action. A different version gives 409; if it does not exist, 404. */
        deleteAiCustomAction: async (params) => withTransaction(pool, async (client) => {
            const cur = await client.query(`SELECT version FROM "${qSchema}".ai_custom_actions WHERE key = $1 FOR UPDATE`, [params.key]);
            const version = cur.rows[0]?.version;
            if (version === undefined)
                throw new CmsError("Not found", "not_found");
            if (version !== params.expectedVersion)
                throw new CmsError("Conflict", "conflict", version);
            await client.query(`DELETE FROM "${qSchema}".ai_custom_actions WHERE key = $1`, [params.key]);
        }),
    };
}
/** AI store built from the main DB connection. Only one is kept even if the dev server reloads the module. */
export function getAiStore() {
    global.__cmsAiStore ??= createAiStore(getCmsDatabase());
    return global.__cmsAiStore;
}
