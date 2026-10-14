export function createPreferencesService(site, store) {
    /** Normalizes stored preferences to the per-collection shape. Unknown or corrupt values (including the removed global page size and sort) are dropped. */
    const normalize = (stored) => {
        const collections = {};
        for (const collection of site.COLLECTIONS) {
            collections[collection] = { ...(stored?.collections?.[collection] ?? {}) };
        }
        const parsed = site.api.preferencesBodySchema.safeParse({ collections, editor: stored?.editor });
        return parsed.success ? parsed.data : {};
    };
    const load = async (userId) => normalize((await store().getPreferences({ userId })));
    return {
        get: load,
        update: async (userId, patch) => {
            const current = await load(userId);
            const collections = { ...current.collections };
            for (const [collection, value] of Object.entries(patch.collections ?? {})) {
                const key = collection;
                collections[key] = { ...collections[key], ...value };
            }
            const preferences = { collections, editor: { ...current.editor, ...patch.editor } };
            await store().savePreferences({ userId, preferences: preferences });
            return preferences;
        },
    };
}
