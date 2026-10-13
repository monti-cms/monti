import type { PreferencesBody } from "../core/api";
import type { ContentStore, JsonObject } from "../core/store";
import type { Site } from "../site";

export interface PreferencesService {
	/** The admin's saved settings, in the per-collection shape (unknown or corrupt values are dropped). */
	get(userId: string): Promise<PreferencesBody>;
	/** Merges and saves per collection: collections and keys that are not sent are kept. Returns what is saved. */
	update(userId: string, patch: PreferencesBody): Promise<PreferencesBody>;
}

export function createPreferencesService(
	site: Pick<Site, "COLLECTIONS" | "api">,
	store: () => Pick<ContentStore, "getPreferences" | "savePreferences">,
): PreferencesService {
	/** Normalizes stored preferences to the per-collection shape. Unknown or corrupt values (including the removed global page size and sort) are dropped. */
	const normalize = (stored: PreferencesBody | null): PreferencesBody => {
		const collections: Record<string, unknown> = {};
		for (const collection of site.COLLECTIONS) {
			collections[collection] = { ...(stored?.collections?.[collection] ?? {}) };
		}
		const parsed = site.api.preferencesBodySchema.safeParse({ collections, editor: stored?.editor });
		return parsed.success ? parsed.data : {};
	};

	const load = async (userId: string) =>
		normalize((await store().getPreferences({ userId })) as PreferencesBody | null);

	return {
		get: load,
		update: async (userId, patch) => {
			const current = await load(userId);
			const collections = { ...current.collections };
			for (const [collection, value] of Object.entries(patch.collections ?? {})) {
				const key = collection as keyof NonNullable<PreferencesBody["collections"]>;
				collections[key] = { ...collections[key], ...value };
			}
			const preferences: PreferencesBody = { collections, editor: { ...current.editor, ...patch.editor } };
			await store().savePreferences({ userId, preferences: preferences as JsonObject });
			return preferences;
		},
	};
}
