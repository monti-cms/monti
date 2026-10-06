import type { Cms, PluginCollection, PluginSecrets, PluginStorage } from "@monti-cms/core/plugin/server";
import { AI_COLLECTIONS } from "./collections";
import { AI_PLUGIN_NAME } from "./plugin-name";
import { aiSecrets, NO_SECRETS } from "./secret";

/** Row name in the AI settings (collection `settings`). */
export type AiSettingsId = "default" | "shared";

/** One row of edited values per action name. */
export interface AiActionOverrideRow {
	key: string;
	/** Edited values that differ from the definition (shape of `aiActionOverrideSchema`). */
	value: unknown;
	version: number;
	updatedAt: Date;
}

const toRow = (item: { key: string; value: unknown; version: number; updatedAt: Date }): AiActionOverrideRow => ({
	key: item.key,
	value: item.value,
	version: item.version,
	updatedAt: item.updatedAt,
});

/** Edited AI action values, connection settings and UI actions, kept in the AI plugin's storage. */
export function createAiStore(
	storage: PluginStorage,
	/** `secrets`: the AI plugin's secrets API for the stored service keys (`aiSecrets(cms)`). Without it, keys cannot be stored or read. */
	options: { readonly secrets?: () => PluginSecrets } = {},
) {
	const overrides: PluginCollection = storage.collection(AI_COLLECTIONS.actionOverrides);
	const custom: PluginCollection = storage.collection(AI_COLLECTIONS.customActions);
	const settings: PluginCollection = storage.collection(AI_COLLECTIONS.settings);
	return {
		secrets: (): PluginSecrets => options.secrets?.() ?? NO_SECRETS,
		/** All edited values, by action name. Actions never edited have none. */
		listAiActionOverrides: async (): Promise<AiActionOverrideRow[]> => (await overrides.list()).map(toRow),

		/**
		 * Changes the edited values. The first time, `expectedVersion` is 0; after that, a different version gives 409.
		 * If the edited values become empty (all defaults), the row is kept so the version carries on.
		 */
		saveAiActionOverride: async (params: {
			key: string;
			expectedVersion: number;
			value: unknown;
		}): Promise<AiActionOverrideRow> =>
			toRow(await overrides.set(params.key, params.value, { expectedVersion: params.expectedVersion })),

		/**
		 * One AI settings row (as stored). `default` is the service connection and `shared` is the edited shared text. `null` if none.
		 */
		getAiSettings: async (id: AiSettingsId = "default"): Promise<{ value: unknown; version: number } | null> => {
			const item = await settings.get(id);
			return item ? { value: item.value, version: item.version } : null;
		},

		/** Saves one settings row. The first time, `expectedVersion` is 0; after that, a different version gives 409. */
		saveAiSettings: async (params: { id?: AiSettingsId; expectedVersion: number; value: unknown }): Promise<number> =>
			(await settings.set(params.id ?? "default", params.value, { expectedVersion: params.expectedVersion })).version,

		/** All UI actions (actions created in the admin screen). In creation order. */
		listAiCustomActions: async (): Promise<AiActionOverrideRow[]> =>
			(await custom.list())
				.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
				.map(toRow),

		/** Creates (`expectedVersion` 0) or edits a UI action. A different version gives 409. */
		saveAiCustomAction: async (params: {
			key: string;
			expectedVersion: number;
			value: unknown;
		}): Promise<AiActionOverrideRow> =>
			toRow(await custom.set(params.key, params.value, { expectedVersion: params.expectedVersion })),

		/** Deletes a UI action. A different version gives 409; if it does not exist, 404. */
		deleteAiCustomAction: async (params: { key: string; expectedVersion: number }): Promise<void> =>
			custom.delete(params.key, { expectedVersion: params.expectedVersion }),
	};
}

export type AiStore = ReturnType<typeof createAiStore>;

const stores = new WeakMap<Cms, AiStore>();

/** The AI store of one CMS instance, built from its plugin storage on first use. Each instance has its own. */
export function aiStoreFor(cms: Cms): AiStore {
	let store = stores.get(cms);
	if (!store) {
		store = createAiStore(cms.storage(AI_PLUGIN_NAME), { secrets: () => aiSecrets(cms) });
		stores.set(cms, store);
	}
	return store;
}
