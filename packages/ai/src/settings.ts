import { randomUUID } from "node:crypto";
import { createTranslator } from "@monti-cms/core/client";
import { z } from "zod";
import type { ResolvedAiAction } from "./action";
import type { AiProviderInput, AiProviderKind, AiProviderView, AiSettingsView } from "./connection";
import { AiError } from "./errors";
import {
	type AiDecider,
	type AiProvider,
	createDecider,
	createFakeDecider,
	createFakeGenerator,
	createGenerator,
	isFakeAi,
} from "./provider";
import { decryptSecret, encryptSecret, keyHint } from "./secret";
import { settingsMessages } from "./settings.messages";

const t = createTranslator(settingsMessages);

/** Settings store (part of the content store). Tests pass an in-memory implementation. */
export interface AiSettingsStore {
	getAiSettings(): Promise<{ value: unknown; version: number } | null>;
	saveAiSettings(params: { expectedVersion: number; value: unknown }): Promise<number>;
}

/** One connection kept in the DB. The key is ciphertext. */
const storedProviderSchema = z.object({
	id: z.string(),
	name: z.string(),
	kind: z.enum(["chat", "decisions"]),
	url: z.string().default(""),
	apiKey: z.string().nullable().default(null),
	defaultModel: z.string().default(""),
});
type StoredProvider = z.output<typeof storedProviderSchema>;

const storedSchema = z.object({ providers: z.array(storedProviderSchema).default([]) });

/**
 * Shape from before connections were kept one by one (one pair of generation/decision connections). Moved into two connections on read.
 * Saving changes it to the new shape.
 */
const legacySchema = z.object({
	generate: z.object({ baseUrl: z.string(), apiKey: z.string().nullable(), smallModel: z.string() }),
	decide: z.object({ url: z.string(), apiKey: z.string().nullable(), shareKey: z.boolean(), model: z.string() }),
});

function readStored(value: unknown): StoredProvider[] {
	const legacy = legacySchema.safeParse(value);
	if (legacy.success) {
		const { generate, decide } = legacy.data;
		return [
			{
				id: "legacy-chat",
				name: t("legacyGenerate"),
				kind: "chat",
				url: generate.baseUrl,
				apiKey: generate.apiKey,
				defaultModel: generate.smallModel,
			},
			{
				id: "legacy-decisions",
				name: t("legacyDecide"),
				kind: "decisions",
				url: decide.url,
				apiKey: decide.shareKey ? generate.apiKey : decide.apiKey,
				defaultModel: decide.model,
			},
		].filter((provider) => provider.url || provider.defaultModel) as StoredProvider[];
	}
	return storedSchema.parse(value ?? {}).providers;
}

interface ResolvedProvider extends StoredProvider {
	/** Decrypted key. `null` if it cannot be decrypted because the server config's `secret` changed. */
	key: string | null;
}

async function load(store: AiSettingsStore): Promise<{ version: number; providers: ResolvedProvider[] }> {
	const row = await store.getAiSettings();
	const providers = readStored(row?.value).map((provider) => ({
		...provider,
		key: provider.apiKey ? decryptSecret(provider.apiKey) : null,
	}));
	return { version: row?.version ?? 0, providers };
}

const isReady = (provider: ResolvedProvider) => Boolean(provider.url && provider.key && provider.defaultModel);

const viewOf = (provider: ResolvedProvider): AiProviderView => ({
	id: provider.id,
	name: provider.name,
	kind: provider.kind,
	url: provider.url,
	keyHint: keyHint(provider.key),
	defaultModel: provider.defaultModel,
	ready: isReady(provider),
});

export async function getAiSettingsView(store: AiSettingsStore): Promise<AiSettingsView> {
	const { version, providers } = await load(store);
	return { version, providers: providers.map(viewOf), fake: isFakeAi() };
}

async function writeProviders(
	store: AiSettingsStore,
	expectedVersion: number,
	providers: StoredProvider[],
): Promise<AiSettingsView> {
	await store.saveAiSettings({
		expectedVersion,
		value: {
			providers: providers.map(({ id, name, kind, url, apiKey, defaultModel }) => ({
				id,
				name,
				kind,
				url,
				apiKey,
				defaultModel,
			})),
		},
	});
	return getAiSettingsView(store);
}

const toStored = (id: string, input: AiProviderInput, storedKey: string | null): StoredProvider => ({
	id,
	name: input.name,
	kind: input.kind,
	url: input.url.replace(/\/+$/, ""),
	apiKey: input.apiKey === undefined ? storedKey : input.apiKey === null ? null : encryptSecret(input.apiKey),
	defaultModel: input.defaultModel,
});

export async function addAiProvider(
	store: AiSettingsStore,
	expectedVersion: number,
	input: AiProviderInput,
): Promise<AiSettingsView> {
	const { providers } = await load(store);
	return writeProviders(store, expectedVersion, [...providers, toStored(randomUUID(), input, null)]);
}

/** Edits a connection. If the key is omitted, the stored key stays; `null` deletes it; a string is encrypted and replaces it. */
export async function updateAiProvider(
	store: AiSettingsStore,
	expectedVersion: number,
	id: string,
	input: AiProviderInput,
): Promise<AiSettingsView> {
	const { providers } = await load(store);
	const current = providers.find((provider) => provider.id === id);
	if (!current) throw new AiError("ai_failed", t("unknownConnection"));
	// If the URL changes without a new key, delete the old key so it is not sent to a different URL.
	const keepKey = input.apiKey === undefined && input.url.replace(/\/+$/, "") !== current.url ? null : current.apiKey;
	return writeProviders(
		store,
		expectedVersion,
		providers.map((provider) => (provider.id === id ? toStored(id, input, keepKey) : provider)),
	);
}

export async function removeAiProvider(
	store: AiSettingsStore,
	expectedVersion: number,
	id: string,
): Promise<AiSettingsView> {
	const { providers } = await load(store);
	return writeProviders(
		store,
		expectedVersion,
		providers.filter((provider) => provider.id !== id),
	);
}

/** URL and key of a stored connection (when fetching the model list). */
export async function savedProvider(
	store: AiSettingsStore,
	id: string,
): Promise<{ kind: AiProviderKind; url: string; apiKey: string | null } | null> {
	const provider = (await load(store)).providers.find((item) => item.id === id);
	return provider ? { kind: provider.kind, url: provider.url, apiKey: provider.key } : null;
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
	if (!provider?.url || !provider.key) return null;
	const model = spec.modelName || provider.defaultModel;
	return model ? { provider, model } : null;
}

export interface AiRuntime {
	generator: AiProvider | null;
	decider: AiDecider | null;
}

/** Generation/decision models to run one action. Fills only the side matching the action's mode. */
export async function loadAiRuntime(store: AiSettingsStore, spec: ActionConnection): Promise<AiRuntime> {
	if (isFakeAi()) return { generator: createFakeGenerator(), decider: createFakeDecider() };
	const picked = pickConnection((await load(store)).providers, spec);
	if (!picked || !picked.provider.key) return { generator: null, decider: null };
	const { provider, model } = picked;
	const key = picked.provider.key;
	return spec.engine === "decide"
		? { generator: null, decider: createDecider({ url: provider.url, apiKey: key, model }) }
		: { generator: createGenerator({ baseUrl: provider.url, apiKey: key, model }), decider: null };
}

/** Whether each action is usable now (whether to attach a button in the slot). Returns the names of usable actions. */
export async function usableActionKeys(
	store: AiSettingsStore,
	actions: ReadonlyArray<ActionConnection & { key: string }>,
): Promise<string[]> {
	if (isFakeAi()) return actions.map((action) => action.key);
	const { providers } = await load(store);
	return actions.filter((action) => pickConnection(providers, action) !== null).map((action) => action.key);
}

/**
 * Call setup used for connection checks. Built from the input values (URL, key, model) before saving.
 * If no new key was entered, uses the key of a connection stored with the same URL (a key stored for a different URL is not sent).
 */
export async function connectionForCheck(
	store: AiSettingsStore,
	params: { providerId?: string; kind: AiProviderKind; url: string; apiKey?: string | null; model: string },
): Promise<{ model: string; generator?: AiProvider; decider?: AiDecider }> {
	const url = params.url.replace(/\/+$/, "");
	const saved = params.providerId
		? (await load(store)).providers.find((item) => item.id === params.providerId)
		: undefined;
	const apiKey = params.apiKey ?? (params.apiKey === undefined && saved?.url === url ? saved.key : null);
	if (!url || !params.model) throw new AiError("ai_unavailable", t("urlAndModel"));
	if (!apiKey) {
		throw new AiError("ai_unavailable", saved?.apiKey && !saved.key ? t("keyAgain") : t("key"));
	}
	const config = { apiKey, model: params.model };
	return params.kind === "chat"
		? { model: params.model, generator: createGenerator({ baseUrl: url, ...config }) }
		: { model: params.model, decider: createDecider({ url, ...config }) };
}
