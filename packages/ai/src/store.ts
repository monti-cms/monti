import type { ApiKeys, Cms, PluginCollection, PluginStorage } from "@monti-cms/core/server";
import type { Site } from "@monti-cms/core/site";
import { type AgentRunValue, createAgentRunStore, createToolSupportStore } from "./agent-store";
import { AI_COLLECTIONS } from "./collections";
import { AiError } from "./errors";
import { AI_PLUGIN_NAME } from "./name";
import { providerMessages } from "./provider.messages";

/** The AI settings, what runs learned about tool calling, and the agent's conversations, kept in the AI plugin's storage. */
export function createAiStore(
	storage: PluginStorage,
	/**
	 * `site`: the site the store works for (the language of its errors). `apiKeys`: the instance's API key store (`() => cms.apiKeys`); a key of an AI service is a connection.
	 * Without it, keys cannot be stored or read.
	 */
	options: {
		readonly site: Pick<Site, "createTranslator">;
		readonly apiKeys?: () => ApiKeys;
	},
) {
	const settings: PluginCollection = storage.collection(AI_COLLECTIONS.settings);
	const toolSupport = createToolSupportStore(storage.collection<Record<string, boolean>>(AI_COLLECTIONS.agentTools));
	const built = {
		...toolSupport,
		/** Conversations of the admin agent. */
		agentRuns: createAgentRunStore(storage.collection<AgentRunValue>(AI_COLLECTIONS.agentRuns)),
		apiKeys: (): ApiKeys => {
			if (!options.apiKeys)
				throw new AiError("service_unavailable", options.site.createTranslator(providerMessages)("noSecret"));
			return options.apiKeys();
		},
		/** The AI settings row (as stored): the quick-task model and how long unopened conversations stay. `null` if none. */
		getAiSettings: async (): Promise<{ value: unknown; version: number } | null> => {
			const item = await settings.get("default");
			return item ? { value: item.value, version: item.version } : null;
		},

		/** Saves the settings row. The first time, `expectedVersion` is 0; after that, a different version gives 409. */
		saveAiSettings: async (params: { expectedVersion: number; value: unknown }): Promise<number> =>
			(await settings.set("default", params.value, { expectedVersion: params.expectedVersion })).version,
	};
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
		}),
	);
}
