import { normalizeMetadata } from "./rows.js";
/** Per-admin list and editor preferences. */
export function createPreferenceOps(ctx) {
    const { pool, qSchema } = ctx;
    return {
        getPreferences: async (params) => {
            const res = await pool.query(`SELECT preferences FROM "${qSchema}".user_preferences WHERE user_id = $1`, [params.userId]);
            if (res.rows.length === 0) {
                return null;
            }
            return res.rows[0].preferences;
        },
        savePreferences: async (params) => {
            const now = new Date();
            const normalized = normalizeMetadata(params.preferences);
            await pool.query(`
				INSERT INTO "${qSchema}".user_preferences AS stored (user_id, preferences, updated_at)
				VALUES ($1, $2, $3)
				ON CONFLICT (user_id)
				DO UPDATE SET preferences = $2, updated_at = $3
				`, [params.userId, JSON.stringify(normalized), now]);
        },
    };
}
