import { normalizeMetadata } from "../../../core/domain/metadata";
import type { JsonObject } from "../../../core/store/types";
import type { StoreContext } from "./context";

/** Per-admin list and editor preferences. */
export function createPreferenceOps(ctx: StoreContext) {
	const db = ctx.db();
	return {
		getPreferences: async (params: { userId: string }): Promise<JsonObject | null> => {
			const row = await db
				.selectFrom("user_preferences")
				.select("preferences")
				.where("user_id", "=", params.userId)
				.executeTakeFirst();
			return row ? row.preferences : null;
		},

		savePreferences: async (params: { userId: string; preferences: JsonObject }): Promise<void> => {
			const now = new Date();
			const preferences = JSON.stringify(normalizeMetadata(params.preferences));
			await db
				.insertInto("user_preferences")
				.values({ user_id: params.userId, preferences, updated_at: now })
				.onConflict((conflict) => conflict.column("user_id").doUpdateSet({ preferences, updated_at: now }))
				.execute();
		},
	};
}
