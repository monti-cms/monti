import type { ApiKeyAccess, ApiKeys } from "@monti-cms/core/server";
import type { ApiKeyView, Site } from "@monti-cms/core/site";
import type { LanguageModel } from "ai";
import { z } from "zod";
import type { ResolvedAiAction } from "./action";
import { agentMessages } from "./agent.messages";
import { createFakeAgentModel } from "./agent-fake";
import type { ToolSupport } from "./agent-store";
import {
	type AgentModelChoice,
	type AiKeyView,
	type AiModelChoice,
	type AiModelView,
	type AiSettingsView,
	aiModelChoiceSchema,
	DEFAULT_UNOPENED_DAYS,
	type UnopenedDays,
	unopenedDaysSchema,
} from "./connection";
import { AiError } from "./errors";
import { AI_PLUGIN_NAME } from "./name";
import {
	type AiDecider,
	type AiProvider,
	createAgentModel,
	createFakeDecider,
	createFakeGenerator,
	createGenerator,
	isFakeAi,
} from "./provider";
import { type AiServiceId, canThink, isAiService, serviceDefaults, serviceUrl } from "./service-models";
import { settingsMessages } from "./settings.messages";

/** Settings store (part of the content store). Tests pass an in-memory implementation. */
export interface AiSettingsStore {
	/** The central API key store (`cms.apiKeys`): a key of an AI service is a connection. */
	apiKeys(): ApiKeys;
	getAiSettings(): Promise<{ value: unknown; version: number } | null>;
	saveAiSettings(params: { expectedVersion: number; value: unknown }): Promise<number>;
	/** What runs learned about tool calling, per key and model. Stores without it (tests) know nothing about the models. */
	getToolSupport?(): Promise<ToolSupport>;
	saveToolSupport?(params: { keyId: string; model: string; supported: boolean }): Promise<void>;
}

const storedSchema = z.object({
	/** The quick-task model, when the admin chose one. */
	quick: aiModelChoiceSchema.optional(),
	/** Days an unopened conversation is kept, when the admin chose; `null` keeps them all. */
	unopenedDays: unopenedDaysSchema.optional(),
});

/**
 * Refs of the uses the AI plugin reports to the key store: `quick:<model>` and `assistant:<model>`. The model is part of the ref, so the label is worked
 * out from the ref alone when the keys are listed.
 */
const QUICK_REF = "quick:";
const ASSISTANT_REF = "assistant:";

const aiKeysOf = (keys: readonly ApiKeyView[]): (ApiKeyView & { service: AiServiceId })[] =>
	keys.filter((key): key is ApiKeyView & { service: AiServiceId } => isAiService(key.service));

const keyView = (key: ApiKeyView & { service: AiServiceId }): AiKeyView => ({
	id: key.id,
	name: key.name,
	service: key.service,
	ready: key.readable,
});

/** The service's default model of the first readable key that has one. */
function defaultOf(
	keys: readonly (ApiKeyView & { service: AiServiceId })[],
	which: "assistant" | "quick",
): AiModelView | null {
	for (const key of keys) {
		const model = key.readable ? serviceDefaults(key.service)?.[which] : undefined;
		if (model) return { keyId: key.id, model, keyName: key.name };
	}
	return null;
}

async function load(store: AiSettingsStore) {
	const row = await store.getAiSettings();
	const stored = storedSchema.parse(row?.value ?? {});
	const { quick: chosen } = stored;
	const keys = aiKeysOf(await store.apiKeys().list());
	const chosenKey = chosen ? keys.find((key) => key.id === chosen.keyId) : undefined;
	const quick: AiModelView | null =
		chosen && chosenKey ? { ...chosen, keyName: chosenKey.name } : defaultOf(keys, "quick");
	return {
		version: row?.version ?? 0,
		stored,
		keys,
		chosen,
		quick,
		assistant: defaultOf(keys, "assistant"),
		unopenedDays: stored.unopenedDays === undefined ? DEFAULT_UNOPENED_DAYS : stored.unopenedDays,
	};
}

/**
 * What the admin reads of the AI settings. It also tells the key store which keys are in use now ({@link reportKeyUses}): the default models follow the keys,
 * which change on the API keys screen without the AI plugin hearing of it.
 */
export async function getAiSettingsView(_site: Site, store: AiSettingsStore): Promise<AiSettingsView> {
	const { version, keys, quick, assistant, unopenedDays } = await load(store);
	await usesOf(store, quick, assistant);
	return {
		version,
		keys: keys.map(keyView),
		quick,
		assistant,
		toolSupport: (await store.getToolSupport?.()) ?? {},
		fake: isFakeAi(),
		unopenedDays,
	};
}

/**
 * Tells the key store which keys the quick tasks and a new conversation use, so the API keys screen lists them and names them before a key is deleted.
 * Only the references are stored; the text shown comes from {@link keyUseLabels} when the keys are read.
 */
export async function reportKeyUses(store: AiSettingsStore): Promise<void> {
	const { quick, assistant } = await load(store);
	await usesOf(store, quick, assistant);
}

const usesOf = (store: AiSettingsStore, quick: AiModelView | null, assistant: AiModelView | null) =>
	store
		.apiKeys()
		.setUses(AI_PLUGIN_NAME, [
			...(quick ? [{ ref: `${QUICK_REF}${quick.model}`, keyId: quick.keyId }] : []),
			...(assistant ? [{ ref: `${ASSISTANT_REF}${assistant.model}`, keyId: assistant.keyId }] : []),
		]);

/** The text for each use, in the admin language, with the model it serves. The plugin's `keyUses`. */
export function keyUseLabels(
	site: Site,
	refs: readonly string[],
): Record<string, { label: string; value: string } | null> {
	const t = site.createTranslator(settingsMessages);
	return Object.fromEntries(
		refs.map((ref) => {
			if (ref.startsWith(QUICK_REF)) return [ref, { label: t("use.quick"), value: ref.slice(QUICK_REF.length) }];
			if (ref.startsWith(ASSISTANT_REF)) {
				return [
					ref,
					{ label: t("use.assistant"), value: t("use.default", { model: ref.slice(ASSISTANT_REF.length) }) },
				];
			}
			return [ref, null];
		}),
	);
}

/** Chooses the quick-task model. The key must be a key of an AI service. */
export async function setQuickModel(
	site: Site,
	store: AiSettingsStore,
	expectedVersion: number,
	quick: AiModelChoice,
): Promise<AiSettingsView> {
	const keys = aiKeysOf(await store.apiKeys().list());
	if (!keys.some((key) => key.id === quick.keyId)) {
		throw new AiError("invalid_input", site.createTranslator(settingsMessages)("unknownKey"));
	}
	const { stored } = await load(store);
	await store.saveAiSettings({ expectedVersion, value: { ...stored, quick } });
	await reportKeyUses(store);
	return getAiSettingsView(site, store);
}

/** Chooses how long a conversation nobody opened is kept. */
export async function setUnopenedDays(
	site: Site,
	store: AiSettingsStore,
	expectedVersion: number,
	unopenedDays: UnopenedDays,
): Promise<AiSettingsView> {
	const { stored } = await load(store);
	await store.saveAiSettings({ expectedVersion, value: { ...stored, unopenedDays } });
	return getAiSettingsView(site, store);
}

/** Days an unopened conversation is kept, as the settings say (the default when never chosen); `null` keeps them all. */
export const unopenedDaysOf = async (store: AiSettingsStore): Promise<UnopenedDays> => (await load(store)).unopenedDays;

/** The service, address and value of an AI key, or `null` when it is not one or cannot be used. */
async function aiAccess(
	store: AiSettingsStore,
	keyId: string,
): Promise<(ApiKeyAccess & { service: AiServiceId }) | null> {
	const access = await store.apiKeys().access(keyId);
	if (!access || !isAiService(access.service) || !access.readable) return null;
	return access as ApiKeyAccess & { service: AiServiceId };
}

/** Address and key to call a model of an AI key with, and what to count its tokens against. */
export async function keyConnection(
	store: AiSettingsStore,
	keyId: string,
): Promise<{
	baseUrl: string;
	apiKey: string;
	service: AiServiceId;
	record: (tokens: number) => Promise<void>;
} | null> {
	const access = await aiAccess(store, keyId);
	if (!access) return null;
	return {
		baseUrl: serviceUrl(access.service, access.url),
		// A server that needs no key still takes the header; an empty one says nothing.
		apiKey: access.value ?? "",
		service: access.service,
		record: (tokens) => store.apiKeys().recordUsage(keyId, tokens),
	};
}

type ActionConnection = Pick<ResolvedAiAction, "engine">;

export interface AiRuntime {
	generator: AiProvider | null;
	decider: AiDecider | null;
}

/**
 * The model an action runs on: the quick-task model. A decision action (a System One model) has no service among the keys any more, so it has no
 * runtime until it becomes an assistant request.
 */
export async function loadAiRuntime(site: Site, store: AiSettingsStore, spec: ActionConnection): Promise<AiRuntime> {
	if (isFakeAi()) return { generator: createFakeGenerator(), decider: createFakeDecider() };
	if (spec.engine === "decide") return { generator: null, decider: null };
	const { quick } = await load(store);
	const connection = quick ? await keyConnection(store, quick.keyId) : null;
	if (!quick || !connection) return { generator: null, decider: null };
	return {
		generator: createGenerator(site, {
			baseUrl: connection.baseUrl,
			apiKey: connection.apiKey,
			model: quick.model,
			onUsage: (tokens) => void connection.record(tokens).catch(() => undefined),
		}),
		decider: null,
	};
}

/** The model the admin agent runs on, and what is known of its tool calling. */
export interface AgentRuntime {
	model: LanguageModel;
	/** The key it calls with (`fake` for the development model). */
	keyId: string;
	modelName: string;
	thinking: AgentModelChoice["thinking"];
	/** Did a run find that the model calls tools? `null`: never tried. */
	tools: boolean | null;
	/** Stores what a run found out about the model's tool calling, so the next request does not try again (or does not refuse). */
	rememberTools(supported: boolean): Promise<void>;
	/** Adds the tokens of a request to the key's count for this month. */
	recordUsage(tokens: number): Promise<void>;
}

/** The refusal for a model that cannot call tools. */
export const noToolsError = (site: Pick<Site, "createTranslator">, model: string) => {
	const t = site.createTranslator(agentMessages);
	return new AiError("agent_unavailable", t("noTools", { model }), { fix: t("noTools.fix") });
};

/**
 * The model for one request of the admin agent: the conversation's choice, or else the built-in default (the service's assistant model of the first key
 * that has one). Refuses when nothing is usable (`service_unavailable`) or when a run found that the model cannot call tools (`agent_unavailable`).
 * A model never tried is let through: the run itself finds out. A thinking level is dropped for a model that cannot think.
 */
export async function loadAgentRuntime(
	site: Site,
	store: AiSettingsStore,
	choice?: AgentModelChoice,
): Promise<AgentRuntime> {
	if (isFakeAi()) {
		return {
			model: createFakeAgentModel(),
			keyId: "fake",
			modelName: "fake-agent",
			thinking: "off",
			tools: true,
			rememberTools: async () => {},
			recordUsage: async () => {},
		};
	}
	const t = site.createTranslator(agentMessages);
	const picked = choice ?? (await load(store)).assistant;
	const connection = picked ? await keyConnection(store, picked.keyId) : null;
	if (!picked || !connection) {
		const reason = choice ? "keyNotReady" : "noKey";
		throw new AiError("service_unavailable", t(reason), { fix: t(`${reason}.fix`) });
	}
	const { model } = picked;
	const thinking = choice && canThink(connection.service, model) ? choice.thinking : "off";
	const tools = (await store.getToolSupport?.())?.[picked.keyId]?.[model] ?? null;
	if (tools === false) throw noToolsError(site, model);
	return {
		model: createAgentModel({ baseUrl: connection.baseUrl, apiKey: connection.apiKey, model }),
		keyId: picked.keyId,
		modelName: model,
		thinking,
		tools,
		rememberTools: (supported) =>
			store.saveToolSupport?.({ keyId: picked.keyId, model, supported }) ?? Promise.resolve(),
		recordUsage: connection.record,
	};
}

/** Whether each action is usable now (whether to attach a button in the slot). Returns the names of usable actions. */
export async function usableActionKeys(
	_site: Site,
	store: AiSettingsStore,
	actions: ReadonlyArray<ActionConnection & { key: string }>,
): Promise<string[]> {
	if (isFakeAi()) return actions.map((action) => action.key);
	const { quick } = await load(store);
	if (!quick || !(await aiAccess(store, quick.keyId))) return [];
	return actions.filter((action) => action.engine !== "decide").map((action) => action.key);
}
