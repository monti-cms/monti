import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AiError } from "./errors.js";
import { createDecider, createFakeDecider, createFakeGenerator, createGenerator, isFakeAi, } from "./provider.js";
import { decryptSecret, encryptSecret, keyHint, refreshSecret } from "./secret.js";
import { settingsMessages } from "./settings.messages.js";
/** One connection kept in the DB. The key is ciphertext. */
const storedProviderSchema = z.object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(["chat", "decisions"]),
    url: z.string().default(""),
    apiKey: z.string().nullable().default(null),
    defaultModel: z.string().default(""),
});
const storedSchema = z.object({ providers: z.array(storedProviderSchema).default([]) });
/**
 * Shape from before connections were kept one by one (one pair of generation/decision connections). Moved into two connections on read.
 * Saving changes it to the new shape.
 */
const legacySchema = z.object({
    generate: z.object({ baseUrl: z.string(), apiKey: z.string().nullable(), smallModel: z.string() }),
    decide: z.object({ url: z.string(), apiKey: z.string().nullable(), shareKey: z.boolean(), model: z.string() }),
});
function readStored(site, value) {
    const t = site.createTranslator(settingsMessages);
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
        ].filter((provider) => provider.url || provider.defaultModel);
    }
    return storedSchema.parse(value ?? {}).providers;
}
async function load(site, store) {
    const row = await store.getAiSettings();
    const providers = readStored(site, row?.value).map((provider) => ({
        ...provider,
        key: provider.apiKey ? decryptSecret(provider.apiKey, store.secrets()) : null,
    }));
    return { version: row?.version ?? 0, providers };
}
const isReady = (provider) => Boolean(provider.url && provider.key && provider.defaultModel);
const viewOf = (provider) => ({
    id: provider.id,
    name: provider.name,
    kind: provider.kind,
    url: provider.url,
    keyHint: keyHint(provider.key),
    defaultModel: provider.defaultModel,
    ready: isReady(provider),
});
export async function getAiSettingsView(site, store) {
    const { version, providers } = await load(site, store);
    return { version, providers: providers.map(viewOf), fake: isFakeAi() };
}
/**
 * The value saved to the settings row. Every stored key is encrypted again with the current secret if it is still in the legacy format
 * (from before per-plugin keys) or was made with a previous secret, so any save upgrades the keys of all connections.
 */
function storedValue(providers, secrets) {
    return {
        providers: providers.map(({ id, name, kind, url, apiKey, defaultModel }) => ({
            id,
            name,
            kind,
            url,
            apiKey: apiKey === null ? null : refreshSecret(apiKey, secrets),
            defaultModel,
        })),
    };
}
async function writeProviders(site, store, expectedVersion, providers) {
    await store.saveAiSettings({ expectedVersion, value: storedValue(providers, store.secrets()) });
    return getAiSettingsView(site, store);
}
/**
 * Encrypts every stored key that is in the legacy format or was made with a previous secret again with the current secret (`monti migrate` runs it).
 * Keys that cannot be decrypted are left as they are. Does nothing when there is no current secret or nothing to upgrade, so it is safe to repeat.
 * A save of the connections that races with it wins (it also upgrades), so a version conflict is not an error.
 * @returns how many keys were upgraded
 */
export async function upgradeStoredKeys(site, store) {
    const secrets = store.secrets();
    if (!secrets.available)
        return 0;
    const row = await store.getAiSettings();
    if (!row)
        return 0;
    const providers = readStored(site, row.value);
    const stale = providers.filter((provider) => provider.apiKey !== null && refreshSecret(provider.apiKey, secrets) !== provider.apiKey);
    if (stale.length === 0)
        return 0;
    try {
        await store.saveAiSettings({ expectedVersion: row.version, value: storedValue(providers, secrets) });
    }
    catch (error) {
        if (error.code === "conflict")
            return 0;
        throw error;
    }
    return stale.length;
}
const toStored = (site, id, input, storedKey, secrets) => ({
    id,
    name: input.name,
    kind: input.kind,
    url: input.url.replace(/\/+$/, ""),
    apiKey: input.apiKey === undefined ? storedKey : input.apiKey === null ? null : encryptSecret(site, input.apiKey, secrets),
    defaultModel: input.defaultModel,
});
export async function addAiProvider(site, store, expectedVersion, input) {
    const { providers } = await load(site, store);
    return writeProviders(site, store, expectedVersion, [
        ...providers,
        toStored(site, randomUUID(), input, null, store.secrets()),
    ]);
}
/** Edits a connection. If the key is omitted, the stored key stays; `null` deletes it; a string is encrypted and replaces it. */
export async function updateAiProvider(site, store, expectedVersion, id, input) {
    const { providers } = await load(site, store);
    const current = providers.find((provider) => provider.id === id);
    if (!current)
        throw new AiError("ai_failed", site.createTranslator(settingsMessages)("unknownConnection"));
    // If the URL changes without a new key, delete the old key so it is not sent to a different URL.
    const keepKey = input.apiKey === undefined && input.url.replace(/\/+$/, "") !== current.url ? null : current.apiKey;
    return writeProviders(site, store, expectedVersion, providers.map((provider) => (provider.id === id ? toStored(site, id, input, keepKey, store.secrets()) : provider)));
}
export async function removeAiProvider(site, store, expectedVersion, id) {
    const { providers } = await load(site, store);
    return writeProviders(site, store, expectedVersion, providers.filter((provider) => provider.id !== id));
}
/** URL and key of a stored connection (when fetching the model list). */
export async function savedProvider(site, store, id) {
    const provider = (await load(site, store)).providers.find((item) => item.id === id);
    return provider ? { kind: provider.kind, url: provider.url, apiKey: provider.key } : null;
}
const kindFor = (spec) => spec.engine === "decide" ? "decisions" : "chat";
/**
 * Connection and model an action uses. If no connection is chosen, the first connection that fits the mode; if no model is chosen, the connection's default model.
 * `null` if unusable (no connection, or the key or URL is empty).
 */
function pickConnection(providers, spec) {
    const kind = kindFor(spec);
    const provider = spec.providerId
        ? providers.find((item) => item.id === spec.providerId && item.kind === kind)
        : providers.find((item) => item.kind === kind && isReady(item));
    if (!provider?.url || !provider.key)
        return null;
    const model = spec.modelName || provider.defaultModel;
    return model ? { provider, model } : null;
}
/** Generation/decision models to run one action. Fills only the side matching the action's mode. */
export async function loadAiRuntime(site, store, spec) {
    if (isFakeAi())
        return { generator: createFakeGenerator(), decider: createFakeDecider() };
    const picked = pickConnection((await load(site, store)).providers, spec);
    if (!picked || !picked.provider.key)
        return { generator: null, decider: null };
    const { provider, model } = picked;
    const key = picked.provider.key;
    return spec.engine === "decide"
        ? { generator: null, decider: createDecider(site, { url: provider.url, apiKey: key, model }) }
        : { generator: createGenerator(site, { baseUrl: provider.url, apiKey: key, model }), decider: null };
}
/** Whether each action is usable now (whether to attach a button in the slot). Returns the names of usable actions. */
export async function usableActionKeys(site, store, actions) {
    if (isFakeAi())
        return actions.map((action) => action.key);
    const { providers } = await load(site, store);
    return actions.filter((action) => pickConnection(providers, action) !== null).map((action) => action.key);
}
/**
 * Call setup used for connection checks. Built from the input values (URL, key, model) before saving.
 * If no new key was entered, uses the key of a connection stored with the same URL (a key stored for a different URL is not sent).
 */
export async function connectionForCheck(site, store, params) {
    const url = params.url.replace(/\/+$/, "");
    const saved = params.providerId
        ? (await load(site, store)).providers.find((item) => item.id === params.providerId)
        : undefined;
    const apiKey = params.apiKey ?? (params.apiKey === undefined && saved?.url === url ? saved.key : null);
    const t = site.createTranslator(settingsMessages);
    if (!url || !params.model)
        throw new AiError("ai_unavailable", t("urlAndModel"));
    if (!apiKey) {
        throw new AiError("ai_unavailable", saved?.apiKey && !saved.key ? t("keyAgain") : t("key"));
    }
    const config = { apiKey, model: params.model };
    return params.kind === "chat"
        ? { model: params.model, generator: createGenerator(site, { baseUrl: url, ...config }) }
        : { model: params.model, decider: createDecider(site, { url, ...config }) };
}
