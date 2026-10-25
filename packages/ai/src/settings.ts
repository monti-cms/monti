import { randomUUID } from "node:crypto";
import type { ApiKeys } from "@monti-cms/core/server";
import type { ApiKeyChoiceInput, ApiKeyView, Site } from "@monti-cms/core/site";
import type { LanguageModel } from "ai";
import { z } from "zod";
import type { ResolvedAiAction } from "./action";
import { agentMessages } from "./agent.messages";
import { createFakeAgentModel } from "./agent-fake";
import type { ToolSupport } from "./agent-store";
import {
	type AiAgentSetting,
	type AiAgentView,
	type AiProviderInput,
	type AiProviderKind,
	type AiProviderView,
	type AiSettingsView,
	aiAgentSettingSchema,
} from "./connection";
import { AiError } from "./errors";
import { AI_PLUGIN_NAME } from "./name";
import {
	type AiDecider,
	type AiProvider,
	createAgentModel,
	createDecider,
	createFakeDecider,
	createFakeGenerator,
	createGenerator,
	isFakeAi,
} from "./provider";
import { settingsMessages } from "./settings.messages";

/** Settings store (part of the content store). Tests pass an in-memory implementation. */
export interface AiSettingsStore {
	/** The central API key store (`cms.apiKeys`): a connection keeps the id of its key, and the value is read from here when the service is called. */
	apiKeys(): ApiKeys;
	/** Runs `work` with a store whose writes (the settings and the key store) are one transaction: all kept, or none if it throws. */
	transaction<T>(work: (scoped: AiSettingsStore) => Promise<T>): Promise<T>;
	getAiSettings(): Promise<{ value: unknown; version: number } | null>;
	saveAiSettings(params: { expectedVersion: number; value: unknown }): Promise<number>;
	/** What the connection check learned about tool calling. Stores without it (tests) know nothing about the models. */
	getToolSupport?(): Promise<ToolSupport>;
	saveToolSupport?(params: { providerId: string; model: string; supported: boolean }): Promise<void>;
	clearToolSupport?(providerId: string): Promise<void>;
}

/** One connection kept in the DB. `keyId` is the id of a key in the central API key store (`null`: no key). */
const storedProviderSchema = z.object({
	id: z.string(),
	name: z.string(),
	kind: z.enum(["chat", "decisions"]),
	url: z.string().default(""),
	keyId: z.string().nullable().default(null),
	defaultModel: z.string().default(""),
});
type StoredProvider = z.output<typeof storedProviderSchema>;

const storedSchema = z.object({
	providers: z.array(storedProviderSchema).default([]),
	/** The model the admin agent runs on, when the admin chose one. */
	agent: aiAgentSettingSchema.optional(),
});

const readStored = (value: unknown): StoredProvider[] => storedSchema.parse(value ?? {}).providers;

interface ResolvedProvider extends StoredProvider {
	/** The key in the store, or `null` if the connection has none or the key was deleted. */
	key: ApiKeyView | null;
}

async function load(
	store: AiSettingsStore,
): Promise<{ version: number; providers: ResolvedProvider[]; agent: AiAgentSetting | undefined }> {
	const row = await store.getAiSettings();
	const { providers: stored, agent } = storedSchema.parse(row?.value ?? {});
	const keys = stored.some((provider) => provider.keyId)
		? new Map((await store.apiKeys().list()).map((key) => [key.id, key]))
		: new Map();
	return {
		version: row?.version ?? 0,
		agent,
		providers: stored.map((provider) => ({ ...provider, key: (provider.keyId && keys.get(provider.keyId)) || null })),
	};
}

const isReady = (provider: ResolvedProvider) =>
	Boolean(provider.url && provider.key?.readable && provider.defaultModel);

const viewOf = (provider: ResolvedProvider): AiProviderView => ({
	id: provider.id,
	name: provider.name,
	kind: provider.kind,
	url: provider.url,
	key: provider.key
		? { id: provider.key.id, name: provider.key.name, tail: provider.key.tail, readable: provider.key.readable }
		: null,
	defaultModel: provider.defaultModel,
	ready: isReady(provider),
	toolSupport: {},
});

/** The connection and model the admin agent runs on: the admin's choice, or else the first ready chat connection with its default model. `null` if neither is usable. */
function pickAgentConnection(
	providers: readonly ResolvedProvider[],
	agent: AiAgentSetting | undefined,
): { provider: ResolvedProvider; model: string } | null {
	if (agent) {
		const provider = providers.find((item) => item.id === agent.providerId && item.kind === "chat");
		return provider && isReady({ ...provider, defaultModel: agent.model }) ? { provider, model: agent.model } : null;
	}
	const provider = providers.find((item) => item.kind === "chat" && isReady(item));
	return provider ? { provider, model: provider.defaultModel } : null;
}

export async function getAiSettingsView(_site: Site, store: AiSettingsStore): Promise<AiSettingsView> {
	const { version, providers, agent } = await load(store);
	const support = (await store.getToolSupport?.()) ?? {};
	const picked = pickAgentConnection(providers, agent);
	const view: AiAgentView = {
		setting: agent ?? null,
		effective: picked
			? {
					providerId: picked.provider.id,
					providerName: picked.provider.name,
					model: picked.model,
					tools: support[picked.provider.id]?.[picked.model] ?? null,
				}
			: null,
	};
	return {
		version,
		providers: providers.map((provider) => ({ ...viewOf(provider), toolSupport: support[provider.id] ?? {} })),
		agent: view,
		fake: isFakeAi(),
	};
}

/**
 * Tells the key store which connections use which key, so the API keys screen can list them and warn before a key is deleted. Only the reference
 * (`connection:<id>`) is stored; the text shown comes from {@link keyUseLabels} when the keys are read.
 */
export async function reportKeyUses(store: AiSettingsStore, providers: readonly StoredProvider[]): Promise<void> {
	await store.apiKeys().setUses(
		AI_PLUGIN_NAME,
		providers.flatMap((provider) =>
			provider.keyId ? [{ ref: connectionRef(provider.id), keyId: provider.keyId }] : [],
		),
	);
}

export const connectionRef = (id: string) => `connection:${id}`;

/**
 * The text for each connection that uses a key, in the admin language and with the connection's name as it is now (`null` for one that was deleted: its use is
 * dropped). The plugin's `keyUses`.
 */
export async function keyUseLabels(
	site: Site,
	store: AiSettingsStore,
	refs: readonly string[],
): Promise<Record<string, string | null>> {
	const t = site.createTranslator(settingsMessages);
	// Only the stored connections, not `load`: the key store calls this while it lists keys, and `load` lists keys, which would call this again without end.
	const stored = readStored((await store.getAiSettings())?.value);
	const names = new Map(stored.map((provider) => [connectionRef(provider.id), provider.name]));
	return Object.fromEntries(
		refs.map((ref) => [ref, names.has(ref) ? t("keyUse", { name: names.get(ref) ?? "" }) : null]),
	);
}

async function writeProviders(
	site: Site,
	store: AiSettingsStore,
	expectedVersion: number,
	providers: StoredProvider[],
	agent: AiAgentSetting | undefined,
): Promise<AiSettingsView> {
	// The agent's choice goes with its connection.
	const kept = agent && providers.some((provider) => provider.id === agent.providerId) ? agent : undefined;
	await store.saveAiSettings({ expectedVersion, value: { providers, ...(kept ? { agent: kept } : {}) } });
	await reportKeyUses(store, providers);
	return getAiSettingsView(site, store);
}

/**
 * Saves a connection together with the key the form chose, in one transaction: a saved key is checked, a typed one is created, and the connection that refers
 * to it is written, all or nothing (a version conflict leaves no new key behind). The key is named after the connection (`Name 2` if taken).
 * `undefined` (the form said nothing about the key): `keep`.
 */
async function saveWithKey(
	store: AiSettingsStore,
	input: AiProviderInput,
	keep: string | null,
	save: (scoped: AiSettingsStore, keyId: string | null) => Promise<AiSettingsView>,
): Promise<AiSettingsView> {
	if (input.key === undefined) return save(store, keep);
	const choice = input.key;
	return store.transaction(async (scoped) =>
		save(scoped, await scoped.apiKeys().choose(choice, { baseName: input.name })),
	);
}

const toStored = (id: string, input: AiProviderInput, keyId: string | null): StoredProvider => ({
	id,
	name: input.name,
	kind: input.kind,
	url: input.url.replace(/\/+$/, ""),
	keyId,
	defaultModel: input.defaultModel,
});

export async function addAiProvider(
	site: Site,
	store: AiSettingsStore,
	expectedVersion: number,
	input: AiProviderInput,
): Promise<AiSettingsView> {
	const { providers, agent } = await load(store);
	return saveWithKey(store, input, null, (scoped, keyId) =>
		writeProviders(
			site,
			scoped,
			expectedVersion,
			[...providers.map(plain), toStored(randomUUID(), input, keyId)],
			agent,
		),
	);
}

/** The connection as it is stored (without the key's details). */
const plain = ({ key: _key, ...stored }: ResolvedProvider): StoredProvider => stored;

/**
 * Edits a connection. If `key` is omitted, the connection keeps its key (unless the address changed: a key is not carried over to a different address silently).
 * Otherwise the chosen key is used: a saved one, a typed one saved as a new key, or none.
 */
export async function updateAiProvider(
	site: Site,
	store: AiSettingsStore,
	expectedVersion: number,
	id: string,
	input: AiProviderInput,
): Promise<AiSettingsView> {
	const { providers, agent } = await load(store);
	const current = providers.find((provider) => provider.id === id);
	if (!current) throw new AiError("upstream_failed", site.createTranslator(settingsMessages)("unknownConnection"));
	const moved = input.url.replace(/\/+$/, "") !== current.url;
	const keep = moved ? null : current.keyId;
	const saved = await saveWithKey(store, input, keep, (scoped, keyId) =>
		writeProviders(
			site,
			scoped,
			expectedVersion,
			providers.map((provider) => (provider.id === id ? toStored(id, input, keyId) : plain(provider))),
			agent,
		),
	);
	// What the check learned about the old address does not hold for a new one.
	if (moved) await store.clearToolSupport?.(id);
	return saved;
}

export async function removeAiProvider(
	site: Site,
	store: AiSettingsStore,
	expectedVersion: number,
	id: string,
): Promise<AiSettingsView> {
	const { providers, agent } = await load(store);
	const saved = await writeProviders(
		site,
		store,
		expectedVersion,
		providers.filter((provider) => provider.id !== id).map(plain),
		agent,
	);
	await store.clearToolSupport?.(id);
	return saved;
}

/** Chooses the model the admin agent runs on (`null`: the default again). The connection must be a chat connection. */
export async function setAgentModel(
	site: Site,
	store: AiSettingsStore,
	expectedVersion: number,
	agent: AiAgentSetting | null,
): Promise<AiSettingsView> {
	const { providers } = await load(store);
	if (agent && !providers.some((provider) => provider.id === agent.providerId && provider.kind === "chat")) {
		throw new AiError("invalid_input", site.createTranslator(settingsMessages)("unknownConnection"));
	}
	return writeProviders(site, store, expectedVersion, providers.map(plain), agent ?? undefined);
}

/** URL and key of a stored connection (when fetching the model list). */
export async function savedProvider(
	store: AiSettingsStore,
	id: string,
): Promise<{ kind: AiProviderKind; url: string; apiKey: string | null } | null> {
	const provider = (await load(store)).providers.find((item) => item.id === id);
	if (!provider) return null;
	return {
		kind: provider.kind,
		url: provider.url,
		apiKey: provider.keyId ? await store.apiKeys().read(provider.keyId) : null,
	};
}

type ActionConnection = Pick<ResolvedAiAction, "engine" | "providerId" | "modelName">;

const kindFor = (spec: Pick<ResolvedAiAction, "engine">): AiProviderKind =>
	spec.engine === "decide" ? "decisions" : "chat";

/**
 * Connection and model an action uses. If no connection is chosen, the first connection that fits the mode; if no model is chosen, the connection's default model.
 * `null` if unusable (no connection, or the key or URL is empty).
 */
function pickConnection(
	providers: ResolvedProvider[],
	spec: ActionConnection,
): { provider: ResolvedProvider; model: string } | null {
	const kind = kindFor(spec);
	const provider = spec.providerId
		? providers.find((item) => item.id === spec.providerId && item.kind === kind)
		: providers.find((item) => item.kind === kind && isReady(item));
	if (!provider?.url || !provider.key?.readable) return null;
	const model = spec.modelName || provider.defaultModel;
	return model ? { provider, model } : null;
}

export interface AiRuntime {
	generator: AiProvider | null;
	decider: AiDecider | null;
}

/** Generation/decision models to run one action. Fills only the side matching the action's mode. */
export async function loadAiRuntime(site: Site, store: AiSettingsStore, spec: ActionConnection): Promise<AiRuntime> {
	if (isFakeAi()) return { generator: createFakeGenerator(), decider: createFakeDecider() };
	const picked = pickConnection((await load(store)).providers, spec);
	const key = picked?.provider.keyId ? await store.apiKeys().read(picked.provider.keyId) : null;
	if (!picked || !key) return { generator: null, decider: null };
	const { provider, model } = picked;
	return spec.engine === "decide"
		? { generator: null, decider: createDecider(site, { url: provider.url, apiKey: key, model }) }
		: { generator: createGenerator(site, { baseUrl: provider.url, apiKey: key, model }), decider: null };
}

/** The model the admin agent runs on, and what is known of its tool calling. */
export interface AgentRuntime {
	model: LanguageModel;
	/** The connection it belongs to (`fake` for the development model). */
	providerId: string;
	modelName: string;
	/** Did the connection check find that the model calls tools? `null`: never checked. */
	tools: boolean | null;
	/** Stores what a run found out about the model's tool calling, so the next request does not try again (or does not refuse). */
	rememberTools(supported: boolean): Promise<void>;
}

/** The refusal for a model that cannot call tools. The AI actions of that connection keep working. */
export const noToolsError = (site: Pick<Site, "createTranslator">, model: string) => {
	const t = site.createTranslator(agentMessages);
	return new AiError("agent_unavailable", t("noTools", { model }), { fix: t("noTools.fix") });
};

/**
 * The model for the admin agent (see {@link pickAgentConnection}). Refuses when nothing is usable (`service_unavailable`) or when the checks found that the
 * chosen model cannot call tools (`agent_unavailable`). A model that was never checked is let through: the run itself finds out.
 */
export async function loadAgentRuntime(site: Site, store: AiSettingsStore): Promise<AgentRuntime> {
	if (isFakeAi()) {
		return {
			model: createFakeAgentModel(),
			providerId: "fake",
			modelName: "fake-agent",
			tools: true,
			rememberTools: async () => {},
		};
	}
	const t = site.createTranslator(agentMessages);
	const { providers, agent } = await load(store);
	const picked = pickAgentConnection(providers, agent);
	const key = picked?.provider.keyId ? await store.apiKeys().read(picked.provider.keyId) : null;
	if (!picked || !key) {
		const chosen = agent ? "connectionNotReady" : "noConnection";
		throw new AiError("service_unavailable", t(chosen), { fix: t(`${chosen}.fix`) });
	}
	const { provider, model } = picked;
	const tools = (await store.getToolSupport?.())?.[provider.id]?.[model] ?? null;
	if (tools === false) throw noToolsError(site, model);
	return {
		model: createAgentModel({ baseUrl: provider.url, apiKey: key, model }),
		providerId: provider.id,
		modelName: model,
		tools,
		rememberTools: (supported) =>
			store.saveToolSupport?.({ providerId: provider.id, model, supported }) ?? Promise.resolve(),
	};
}

/** Whether each action is usable now (whether to attach a button in the slot). Returns the names of usable actions. */
export async function usableActionKeys(
	_site: Site,
	store: AiSettingsStore,
	actions: ReadonlyArray<ActionConnection & { key: string }>,
): Promise<string[]> {
	if (isFakeAi()) return actions.map((action) => action.key);
	const { providers } = await load(store);
	return actions.filter((action) => pickConnection(providers, action) !== null).map((action) => action.key);
}

/**
 * Call setup used for connection checks. Built from the input values (URL, key, model) before saving.
 * The key is the one the form chose: a saved key, a typed one (used for the check only, not saved), or none. If the form says nothing about the key, the stored
 * connection's key is used when its address is the same (a key stored for a different address is not sent).
 */
export async function connectionForCheck(
	site: Site,
	store: AiSettingsStore,
	params: { providerId?: string; kind: AiProviderKind; url: string; key?: ApiKeyChoiceInput; model: string },
): Promise<{
	model: string;
	generator?: AiProvider;
	decider?: AiDecider;
	/** The saved connection this check is for, when its address is unchanged: what the check learns about the model can be stored for it. */
	storedAs?: string;
	/** Address, key and model of a chat check, for the tool-support probe. */
	chat?: { baseUrl: string; apiKey: string; model: string };
}> {
	const url = params.url.replace(/\/+$/, "");
	const saved = params.providerId
		? (await load(store)).providers.find((item) => item.id === params.providerId)
		: undefined;
	const { key } = params;
	let apiKey: string | null = null;
	let unreadable = false;
	if (key === undefined) {
		if (saved?.keyId && saved.url === url) {
			apiKey = await store.apiKeys().read(saved.keyId);
			unreadable = apiKey === null;
		}
	} else if (key.use === "saved") {
		apiKey = await store.apiKeys().read(key.keyId);
		unreadable = apiKey === null;
	} else if (key.use === "new") {
		apiKey = key.value;
	}
	const t = site.createTranslator(settingsMessages);
	if (!url || !params.model) throw new AiError("service_unavailable", t("urlAndModel"));
	if (!apiKey) throw new AiError("service_unavailable", unreadable ? t("keyAgain") : t("key"));
	const config = { apiKey, model: params.model };
	return params.kind === "chat"
		? {
				model: params.model,
				generator: createGenerator(site, { baseUrl: url, ...config }),
				chat: { baseUrl: url, ...config },
				...(saved && saved.url === url ? { storedAs: saved.id } : {}),
			}
		: { model: params.model, decider: createDecider(site, { url, ...config }) };
}
