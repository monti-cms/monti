import type { ApiKeys, Cms, PluginCollection, PluginStorage } from "@monti-cms/core/server";
import type { Site } from "@monti-cms/core/site";
import { createProposalStore, type ProposalValue } from "./agent/proposals";
import { type AgentRunValue, createAgentRunStore, createToolSupportStore } from "./agent-store";
import { AI_COLLECTIONS } from "./collections";
import { AiError } from "./errors";
import { AI_PLUGIN_NAME } from "./name";
import { providerMessages } from "./provider.messages";

/** The item of the settings collection that holds the writing rules. */
const WRITING_RULES = "writing-rules";

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
		/** The proposals the agent's runs made. */
		proposals: createProposalStore(storage.collection<ProposalValue>(AI_COLLECTIONS.agentProposals)),
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

		/**
		 * The site's writing rules (Settings › Site › Writing rules): one text the agent and the quick tasks follow. It is kept in the database, so a deployed
		 * site can change it. Empty when never written.
		 */
		getWritingRules: async (): Promise<string> => {
			const item = await settings.get(WRITING_RULES);
			return typeof (item?.value as { text?: unknown } | undefined)?.text === "string"
				? (item?.value as { text: string }).text
				: "";
		},

		/** The writing rules row as stored, with its version, for the settings screen. */
		getWritingRulesRow: async (): Promise<{ text: string; version: number }> => {
			const item = await settings.get(WRITING_RULES);
			const text = (item?.value as { text?: unknown } | undefined)?.text;
			return { text: typeof text === "string" ? text : "", version: item?.version ?? 0 };
		},

		/** Saves the writing rules. The first time, `expectedVersion` is 0; after that, a different version gives 409. */
		saveWritingRules: async (params: { expectedVersion: number; text: string }): Promise<number> =>
			(await settings.set(WRITING_RULES, { text: params.text }, { expectedVersion: params.expectedVersion })).version,

		/** Saves the settings row. The first time, `expectedVersion` is 0; after that, a different version gives 409. */
		saveAiSettings: async (params: { expectedVersion: number; value: unknown }): Promise<number> =>
			(await settings.set("default", params.value, { expectedVersion: params.expectedVersion })).version,
	};
	return {
		...built,
		/** Deletes this admin's conversations left unopened for `days` days, with their proposals. `null` keeps them all. */
		sweepRuns: async (adminId: string, days: number | null): Promise<void> => {
			for (const runId of await built.agentRuns.sweep(adminId, days)) await built.proposals.removeOfRun(adminId, runId);
		},
		/** Deletes one conversation of this admin with its proposals. `false` when there is none. */
		removeRun: async (adminId: string, runId: string): Promise<boolean> => {
			const removed = await built.agentRuns.remove(adminId, runId);
			if (removed) await built.proposals.removeOfRun(adminId, runId);
			return removed;
		},
	};
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
