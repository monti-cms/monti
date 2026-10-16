import { randomUUID } from "node:crypto";
import type { ApiKeys } from "@monti-cms/core/server";
import type { ApiKeyChoiceInput, ApiKeyView, Site } from "@monti-cms/core/site";
import { z } from "zod";
import type { ResolvedAiAction } from "./action";
import type { AiProviderInput, AiProviderKind, AiProviderView, AiSettingsView } from "./connection";
import { AiError } from "./errors";
import { AI_PLUGIN_NAME } from "./name";
import {
	type AiDecider,
	type AiProvider,
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

const storedSchema = z.object({ providers: z.array(storedProviderSchema).default([]) });

const readStored = (value: unknown): StoredProvider[] => storedSchema.parse(value ?? {}).providers;

interface ResolvedProvider extends StoredProvider {
	/** The key in the store, or `null` if the connection has none or the key was deleted. */
	key: ApiKeyView | null;
}

async function load(store: AiSettingsStore): Promise<{ version: number; providers: ResolvedProvider[] }> {
	const row = await store.getAiSettings();
	const stored = readStored(row?.value);
	const keys = stored.some((provider) => provider.keyId)
		? new Map((await store.apiKeys().list()).map((key) => [key.id, key]))
		: new Map();
	return {
		version: row?.version ?? 0,
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
});

export async function getAiSettingsView(_site: Site, store: AiSettingsStore): Promise<AiSettingsView> {
	const { version, providers } = await load(store);
	return { version, providers: providers.map(viewOf), fake: isFakeAi() };
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
): Promise<AiSettingsView> {
	await store.saveAiSettings({ expectedVersion, value: { providers } });
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
	const { providers } = await load(store);
	return saveWithKey(store, input, null, (scoped, keyId) =>
		writeProviders(site, scoped, expectedVersion, [...providers.map(plain), toStored(randomUUID(), input, keyId)]),
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
	const { providers } = await load(store);
	const current = providers.find((provider) => provider.id === id);
	if (!current) throw new AiError("upstream_failed", site.createTranslator(settingsMessages)("unknownConnection"));
	const keep = input.url.replace(/\/+$/, "") !== current.url ? null : current.keyId;
	return saveWithKey(store, input, keep, (scoped, keyId) =>
		writeProviders(
			site,
			scoped,
			expectedVersion,
			providers.map((provider) => (provider.id === id ? toStored(id, input, keyId) : plain(provider))),
		),
	);
}

export async function removeAiProvider(
	site: Site,
	store: AiSettingsStore,
	expectedVersion: number,
	id: string,
): Promise<AiSettingsView> {
	const { providers } = await load(store);
	return writeProviders(site, store, expectedVersion, providers.filter((provider) => provider.id !== id).map(plain));
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
): Promise<{ model: string; generator?: AiProvider; decider?: AiDecider }> {
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
		? { model: params.model, generator: createGenerator(site, { baseUrl: url, ...config }) }
		: { model: params.model, decider: createDecider(site, { url, ...config }) };
}
