import type { ApiKeys, Cms, PluginCollection, PluginStorage } from "@monti-cms/core/server";
import type { Site } from "@monti-cms/core/site";
import { type AgentRunValue, createAgentRunStore, createToolSupportStore } from "./agent-store";
import { AI_COLLECTIONS } from "./collections";
import { AiError } from "./errors";
import { AI_PLUGIN_NAME } from "./name";
import { providerMessages } from "./provider.messages";
import type { AiSettingsStore } from "./settings";

/** Row name in the AI settings (collection `settings`). */
// The row id `shared` is the name the prompt snippets were first stored under; it is kept as is (stored data, not user-visible).
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
	/**
	 * `site`: the site the store works for (the language of its errors). `apiKeys`: the instance's API key store (`() => cms.apiKeys`) the connections' keys live in.
	 * Without it, keys cannot be stored or read.
	 */
	options: {
		readonly site: Pick<Site, "createTranslator">;
		readonly apiKeys?: () => ApiKeys;
		/** Runs work over one transaction (`cms.transaction`): the plugin's storage and the key store inside it. Without it the work runs on this store, not atomically. */
		readonly transaction?: <T>(work: (storage: PluginStorage, apiKeys: ApiKeys) => Promise<T>) => Promise<T>;
	},
) {
	const overrides: PluginCollection = storage.collection(AI_COLLECTIONS.actionOverrides);
	const custom: PluginCollection = storage.collection(AI_COLLECTIONS.customActions);
	const settings: PluginCollection = storage.collection(AI_COLLECTIONS.settings);
	const toolSupport = createToolSupportStore(storage.collection<Record<string, boolean>>(AI_COLLECTIONS.agentTools));
	const holder: { current?: AiSettingsStore } = {};
	const built = {
		...toolSupport,
		/** Conversations of the admin agent. */
		agentRuns: createAgentRunStore(storage.collection<AgentRunValue>(AI_COLLECTIONS.agentRuns)),
		apiKeys: (): ApiKeys => {
			if (!options.apiKeys)
				throw new AiError("service_unavailable", options.site.createTranslator(providerMessages)("noSecret"));
			return options.apiKeys();
		},
		/** Runs `work` with a store whose writes (settings and the key store) are one transaction: all kept, or none if it throws. */
		transaction: async <T>(work: (scoped: AiSettingsStore) => Promise<T>): Promise<T> =>
			options.transaction
				? options.transaction((txStorage, txKeys) =>
						work(createAiStore(txStorage, { site: options.site, apiKeys: () => txKeys })),
					)
				: work(holder.current as AiSettingsStore),
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
		 * One AI settings row (as stored). `default` is the service connection and `shared` is the edited prompt snippets (the stored row name `shared` is kept). `null` if none.
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
	holder.current = built;
	return built;
}

export type AiStore = ReturnType<typeof createAiStore>;

/** The AI store of one CMS instance, built from its plugin storage on first use. It is rebuilt when the site is reloaded (`cms.plugin(...).once`). */
export function aiStoreFor(cms: Cms): AiStore {
	const plugin = cms.plugin(AI_PLUGIN_NAME);
	return plugin.once("store", () =>
		createAiStore(plugin.storage, {
			site: cms.site,
			apiKeys: () => cms.apiKeys,
			transaction: (work) => cms.transaction((tx) => work(tx.storage(AI_PLUGIN_NAME), tx.apiKeys)),
		}),
	);
}
